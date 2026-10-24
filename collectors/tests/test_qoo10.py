"""Qoo10 수집기 테스트. 네트워크를 쓰지 않고, 가짜 문장으로 만든 HTML만 쓴다 (실제 리뷰 원문은 넣지 않는다).

실행 (저장소 루트에서): python -m unittest discover -s collectors/tests -t .
"""

import re
import unittest
from unittest import mock

import requests

from collectors.sources import qoo10 as q


def listing_html(items: list[tuple[str, str]]) -> str:
    """items: [(gd_no, title)]"""
    cards = "".join(
        f'<li id="g_{no}" goodscode="{no}" ga-product="goods"><a class="txt_brand" href="#">'
        f'<span class="official">公式</span> ブランド{no}</a><a class="tt" href="/item/x/{no}" title="{title}">t</a></li>'
        for no, title in items
    )
    return f'<ul id="search_result_item_list">{cards}</ul>'


def review_html(rows: list[tuple[str, int]]) -> str:
    """rows: [(review_id, rating)]"""
    return "".join(
        f'<li><div class="detail_reviewstar"><p class="reviewstar_ratecnt"><span class="value">{star}</span>'
        f'<span>5</span></p><p class="reviewstar_text"><span>abc***</span><span>2026.06.12</span></p></div>'
        f'<button id="like_R_{rid}" class="btn_like">3</button>'
        f'<p class="content_option"><span class="option_type">肌タイプ: 乾燥肌</span></p>'
        f'<ul class="content_review"><li><div class="review_wrap"><span>保湿力</span>満足です</div></li></ul>'
        f'<p class="content_text">テスト本文<br>{rid}</p></li>'
        for rid, star in rows
    )


def summary_html(total: str = "143,807", score: str = "4.6") -> str:
    return (
        f'<div class="review_aigrade"><p class="text_rate"><span class="rate_score">{score}</span>'
        f'<span class="rate_count">( {total} 件のレビュー)</span></p></div>'
    )


class FakeClient:
    """Client를 대신한다. 호출 순서대로 미리 정한 응답을 돌려준다."""

    def __init__(self, gets: list[str] | None = None, posts: list[str] | None = None) -> None:
        self.gets, self.posts = list(gets or []), list(posts or [])
        self.requests_made = 0

    def get(self, url: str) -> str:
        self.requests_made += 1
        return self.gets.pop(0)

    def post_empty(self, url: str, referer: str) -> str:
        self.requests_made += 1
        reply = self.posts.pop(0)
        if isinstance(reply, Exception):
            raise reply
        return reply


class PagedFake:
    """낮은 별점순 리뷰 목록을 흉내 낸다. 리뷰(번호, 별점) 목록을 요청한 page_no · page_size대로 잘라 주고, 어느 페이지를 열었는지 기록한다."""

    def __init__(self, rows: list[tuple[str, int]], gets: list[str] | None = None) -> None:
        self.rows = rows
        self.gets = list(gets or [])
        self.requests_made = 0
        self.pages_asked: list[int] = []

    def get(self, url: str) -> str:
        self.requests_made += 1
        return self.gets.pop(0)

    def post_empty(self, url: str, referer: str) -> str:
        self.requests_made += 1
        page = int(re.search(r"page_no=(\d+)", url).group(1))
        size = int(re.search(r"page_size=(\d+)", url).group(1))
        self.pages_asked.append(page)
        return review_html(self.rows[(page - 1) * size : page * size])


def sorted_list(**counts: int) -> list[tuple[str, int]]:
    """별점별 리뷰 수(s1=…, s2=…)로 낮은 별점순 목록을 만든다. 번호는 r0, r1, … (같은 별점 안에서는 앞이 더 최근)."""
    rows: list[tuple[str, int]] = []
    for key in sorted(counts):
        rows += [(f"r{len(rows) + i}", int(key[1:])) for i in range(counts[key])]
    return rows


def ids(reviews: list[dict]) -> list[str]:
    return [r["external_id"] for r in reviews]


class ParseTest(unittest.TestCase):
    def test_listing_reads_number_brand_title_and_flags_sets(self):
        items = q.parse_listing(listing_html([("111", "化粧水 200ml"), ("222", "化粧水 2本セット")]))
        self.assertEqual([i["gd_no"] for i in items], ["111", "222"])
        self.assertEqual(items[0]["brand"], "ブランド111")  # "公式" 표시는 브랜드명에서 뺀다
        self.assertEqual([i["is_set"] for i in items], [False, True])

    def test_reviews_read_fields(self):
        review = q.parse_reviews(review_html([("900", 2)]))[0]
        self.assertEqual(review["external_id"], "900")
        self.assertEqual(review["rating"], 2)
        self.assertEqual(review["posted_at"], "2026-06-12")
        self.assertEqual(review["body"], "テスト本文\n900")
        self.assertEqual(review["raw"]["options"], {"肌タイプ": "乾燥肌"})
        self.assertEqual(review["raw"]["aspects"], [{"aspect": "保湿力", "verdict": "満足です"}])
        self.assertEqual(review["raw"]["likes"], 3)

    def test_empty_html_gives_no_items(self):
        self.assertEqual(q.parse_listing(""), [])
        self.assertEqual(q.parse_reviews("<p>条件に合うレビューがありません</p>"), [])


class SummaryTest(unittest.TestCase):
    def test_reads_total_count_and_average(self):
        self.assertEqual(q.parse_summary(summary_html()), {"total_count": 143807, "avg_rating": 4.6})

    def test_unreadable_page_gives_none_instead_of_failing(self):
        self.assertEqual(q.parse_summary("<p>x</p>"), {"total_count": None, "avg_rating": None})

    def test_fetch_summary_reads_the_reviews_page(self):
        got = q.fetch_summary(FakeClient(gets=[summary_html("1,234")]), "999")
        self.assertEqual(got["total_count"], 1234)
        self.assertIn("goodscode=999", q.summary_url("999"))


class SaveStateTest(unittest.TestCase):
    def test_never_saved_product_is_not_saved_even_with_new_reviews(self):
        self.assertEqual(q.save_state(False, 12), "not_saved")
        self.assertEqual(q.save_state(False, 0), "not_saved")

    def test_saved_before_and_nothing_new_is_fully_saved(self):
        self.assertEqual(q.save_state(True, 0), "fully_saved")

    def test_saved_before_and_new_low_reviews_is_partly_saved(self):
        self.assertEqual(q.save_state(True, 3), "partly_saved")


class FindStartPageTest(unittest.TestCase):
    def pages(self, rows, **kw):
        fake = PagedFake(rows)
        return fake, q.ReviewPages(fake, "999", **kw)

    def test_star_one_starts_at_page_one_without_any_request(self):
        fake, pages = self.pages(sorted_list(s1=50, s2=50))
        self.assertEqual(q.find_start_page(pages, 1), 1)
        self.assertEqual(fake.requests_made, 0)

    def test_finds_the_first_page_that_reaches_the_star(self):
        # 1점 300건(15페이지) 다음 2점 200건 다음 3점 → 3점은 (500번째 리뷰) = 26페이지
        fake, pages = self.pages(sorted_list(s1=300, s2=200, s3=400, s4=100))
        self.assertEqual(q.find_start_page(pages, 3), 26)

    def test_start_page_can_be_in_the_middle_of_a_page(self):
        fake, pages = self.pages(sorted_list(s1=25, s2=25, s3=50))  # 3점은 51번째부터 = 3페이지(41~60번째) 한가운데
        self.assertEqual(q.find_start_page(pages, 3), 3)

    def test_huge_list_needs_only_a_handful_of_requests(self):
        fake, pages = self.pages(sorted_list(s1=1500, s2=1000, s3=3000, s4=500, s5=5000))  # 3점은 125페이지부터
        self.assertEqual(q.find_start_page(pages, 3), 126)
        self.assertLessEqual(fake.requests_made, 16)  # 125페이지를 하나씩 읽는 것과 비교

    def test_a_known_lower_page_shortens_the_search(self):
        rows = sorted_list(s1=1500, s2=1000, s3=3000)
        fake, pages = self.pages(rows)
        self.assertEqual(q.find_start_page(pages, 3, after=100), 126)
        fake2, pages2 = self.pages(rows)
        q.find_start_page(pages2, 3)
        self.assertLess(fake.requests_made, fake2.requests_made)

    def test_star_that_does_not_exist_gives_none(self):
        fake, pages = self.pages(sorted_list(s1=30, s2=30, s3=30))
        self.assertIsNone(q.find_start_page(pages, 4))

    def test_empty_product_gives_none(self):
        fake, pages = self.pages([])
        self.assertIsNone(q.find_start_page(pages, 3))

    def test_same_page_is_requested_only_once(self):
        fake, pages = self.pages(sorted_list(s1=100, s2=100))
        pages.get(2)
        pages.get(2)
        self.assertEqual(fake.pages_asked, [2])

    def test_request_budget_stops_a_runaway_search(self):
        fake, pages = self.pages(sorted_list(s1=100000, s5=10), budget=4)
        with self.assertRaises(ValueError):
            q.find_start_page(pages, 5)


class ReadStarTest(unittest.TestCase):
    def read(self, rows, star, start, quota, known=()):
        fake = PagedFake(rows)
        got, info = q.read_star(q.ReviewPages(fake, "999"), star, start, quota, set(known))
        return fake, got, info

    def test_collects_the_newest_reviews_of_that_star_up_to_quota(self):
        _, got, info = self.read(sorted_list(s1=40, s2=100), star=2, start=2, quota=20)
        self.assertEqual(ids(got), [f"r{i}" for i in range(40, 60)])
        self.assertEqual((info["new"], info["exhausted"]), (20, False))

    def test_skips_the_mixed_start_of_the_page_and_only_takes_that_star(self):
        _, got, _ = self.read(sorted_list(s1=25, s2=25, s3=50), star=3, start=3, quota=5)
        self.assertEqual(ids(got), ["r50", "r51", "r52", "r53", "r54"])

    def test_known_reviews_are_skipped_and_do_not_count_toward_quota(self):
        known = {f"r{i}" for i in range(40, 60)}
        _, got, info = self.read(sorted_list(s1=40, s2=100), star=2, start=2, quota=20, known=known)
        self.assertEqual(ids(got), [f"r{i}" for i in range(60, 80)])  # 이미 가진 20건 다음 20건
        self.assertEqual((info["skipped_known"], info["new"]), (20, 20))

    def test_nothing_new_when_everything_up_to_the_end_is_known(self):
        rows = sorted_list(s2=12, s3=5)
        _, got, info = self.read(rows, star=2, start=1, quota=20, known={r[0] for r in rows})
        self.assertEqual((got, info["exhausted"]), ([], True))

    def test_block_end_is_reported_as_exhausted_with_the_exact_count(self):
        _, got, info = self.read(sorted_list(s2=15, s3=100), star=2, start=1, quota=20)
        self.assertEqual((len(got), info["read"], info["exhausted"]), (15, 15, True))

    def test_end_of_list_is_exhausted_too(self):
        _, got, info = self.read(sorted_list(s3=7), star=3, start=1, quota=20)
        self.assertEqual((len(got), info["exhausted"]), (7, True))

    def test_new_arrivals_come_first_then_the_next_older_ones(self):
        before = sorted_list(s3=60)
        first = [r[0] for r in before[:20]]
        after = [("new1", 3), ("new2", 3)] + before  # 그 사이 3점 2건이 새로 올라왔다
        _, got, _ = self.read(after, star=3, start=1, quota=20, known=first)
        self.assertEqual(ids(got), ["new1", "new2"] + [f"r{i}" for i in range(20, 38)])  # 새 리뷰 2건 + 그다음으로 오래된 18건


class CollectStarsTest(unittest.TestCase):
    def test_only_checked_stars_are_read_each_with_its_own_quota(self):
        fake = PagedFake(sorted_list(s1=100, s2=100, s3=100, s4=100))
        got, info = q.collect_stars(fake, "999", [1, 3], quota=10, known_ids=set())
        by_star = {s: [r for r in got if r["rating"] == s] for s in (1, 2, 3)}
        self.assertEqual((len(by_star[1]), len(by_star[2]), len(by_star[3])), (10, 0, 10))
        self.assertEqual(set(info["stars"]), {"1", "3"})

    def test_three_stars_get_ten_each(self):
        fake = PagedFake(sorted_list(s1=100, s2=100, s3=100))
        got, info = q.collect_stars(fake, "999", [3, 1, 2], quota=10, known_ids=set())
        self.assertEqual(len(got), 30)
        self.assertEqual([info["stars"][s]["new"] for s in ("1", "2", "3")], [10, 10, 10])
        self.assertFalse(info["low_count_exact"])  # 어느 별점도 끝까지 읽지 않았다
        self.assertEqual(info["stop"], "limit")

    def test_second_run_brings_the_next_ones_without_duplicates(self):
        rows = sorted_list(s1=5, s2=5, s3=200)
        first, _ = q.collect_stars(PagedFake(rows), "999", [3], quota=20, known_ids=set())
        second, _ = q.collect_stars(PagedFake(rows), "999", [3], quota=20, known_ids=set(ids(first)))
        self.assertEqual(len(first), 20)
        self.assertEqual(len(second), 20)
        self.assertFalse(set(ids(first)) & set(ids(second)))
        self.assertEqual(ids(second), [f"r{i}" for i in range(30, 50)])  # 바로 그다음으로 최근

    def test_missing_star_is_reported_without_more_requests_for_higher_stars(self):
        fake = PagedFake(sorted_list(s1=30, s2=30))
        got, info = q.collect_stars(fake, "999", [3, 4, 5], quota=10, known_ids=set())
        self.assertEqual(got, [])
        self.assertTrue(all(i["exhausted"] and i["new"] == 0 for i in info["stars"].values()))
        self.assertTrue(info["low_count_exact"])

    def test_exact_count_when_every_checked_star_is_read_to_its_end(self):
        fake = PagedFake(sorted_list(s2=8, s3=6, s4=50))
        got, info = q.collect_stars(fake, "999", [2, 3], quota=20, known_ids=set())
        self.assertEqual((len(got), info["low_count"], info["low_count_exact"], info["stop"]), (14, 14, True, "max_star"))

    def test_three_star_only_run_is_cheap_on_a_big_product(self):
        fake = PagedFake(sorted_list(s1=700, s2=400, s3=2000, s4=500))  # 3점은 56페이지부터
        got, info = q.collect_stars(fake, "999", [3], quota=20, known_ids=set())
        self.assertEqual(len(got), 20)
        self.assertEqual(ids(got), [f"r{i}" for i in range(1100, 1120)])
        self.assertLessEqual(info["requests"], 12)

    def test_start_page_is_recorded_per_star(self):
        fake = PagedFake(sorted_list(s1=40, s2=40, s3=40))
        _, info = q.collect_stars(fake, "999", [1, 2, 3], quota=5, known_ids=set())
        self.assertEqual([info["stars"][s]["start_page"] for s in ("1", "2", "3")], [1, 3, 5])


class ParseStarsTest(unittest.TestCase):
    def test_parses_one_or_several(self):
        self.assertEqual(q.parse_stars("3"), [3])
        self.assertEqual(q.parse_stars("3,1,2"), [1, 2, 3])
        self.assertEqual(q.parse_stars("2, 2"), [2])

    def test_rejects_out_of_range_and_garbage(self):
        for text in ["", "0", "6", "a", "1,x", ","]:
            self.assertIsNone(q.parse_stars(text), text)


class ClassifyListingTest(unittest.TestCase):
    """제목만 보는 규칙. 확실한 것만 빼고 애매한 것은 남기는 것이 목적이다 (가상의 제목으로 확인)."""

    def reason(self, title: str):
        return q.classify_listing(title, "toner")

    def test_plain_toner_is_kept(self):
        for title in ["保湿 化粧水 200ml", "鎮静トナー 150ml", "ヒアルロン酸ローション"]:
            self.assertIsNone(self.reason(title), title)

    def test_set_is_excluded(self):
        self.assertEqual(self.reason("【2本セット】 大容量化粧水"), "set")

    def test_listing_that_sells_several_kinds_is_excluded(self):
        self.assertEqual(self.reason("ベスト シリーズ／化粧水／セラム／クリーム"), "multi_type")
        self.assertEqual(self.reason("スキンケア 化粧水 乳液 つめかえ用"), "multi_type")

    def test_other_kind_only_is_excluded(self):
        self.assertEqual(self.reason("毛穴ケア クレンジング 2種から選べる"), "not_toner")
        self.assertEqual(self.reason("低刺激 保湿クリーム"), "not_toner")

    def test_toner_whose_name_contains_other_kind_words_is_kept(self):
        self.assertIsNone(self.reason("エッセンストナー 200ml"))
        self.assertIsNone(self.reason("セラムトナー 180ml"))
        self.assertIsNone(self.reason("クリームスキン ローション 170ml"))  # 브랜드 이름이 크림이다
        self.assertIsNone(self.reason("GGエッセンス 美容水 化粧水 60ml"))  # 에센스형 토너

    def test_option_listing_of_one_kind_is_kept_for_a_human_to_check(self):
        self.assertIsNone(self.reason("選べるトナー10種 ドクダミ/桃/ライス"))

    def test_title_with_no_kind_word_is_kept(self):
        self.assertIsNone(self.reason("ザ タイム アクア 200ml"))

    def test_categories_without_a_target_kind_only_exclude_sets(self):
        self.assertIsNone(q.classify_listing("洗顔クレンジング", "cream"))
        self.assertEqual(q.classify_listing("2本セット 美容液", "cream"), "set")


class ClassifyEssenceListingTest(unittest.TestCase):
    """에센스(美容液) 카테고리의 제외 규칙. 실제 목록 40개를 읽고 정한 패턴을 가상의 제목으로 확인한다."""

    def reason(self, title: str):
        return q.classify_listing(title, "serum")

    def test_single_essence_listings_are_kept(self):
        for title in [
            "ビタミンC セラム 30ml",
            "ナイアシン エッセンス 30mL 60mL 高濃縮美容液",
            "【2種GIFT付】PDRNアンプル 30ml",
            "PDRNカフェインショット 30ml/50ml",  # ショット는 에센스 단어
            "【導入美容液】ヒアルロン セラム 80mL",
            "ビタミンC アンプル 25% 23ml/40% 15g",  # 농도 · 용량 선택은 한 제품
        ]:
            self.assertIsNone(self.reason(title), title)

    def test_sets_are_excluded(self):
        self.assertEqual(self.reason("【美容液1+1】 選べる美容液 2点セット"), "set")
        self.assertEqual(self.reason("ハイドロキノン 3本セット"), "set")
        self.assertEqual(self.reason("グリーンアンプル 15ml 2個 1個も選べる"), "set")

    def test_essence_sold_together_with_other_kinds_is_excluded(self):
        self.assertEqual(self.reason("スキンブースターセラム 150mL / 導入美容液 / 化粧水"), "multi_type")
        self.assertEqual(self.reason("セラム 30ml アクティブクリーム 50ml"), "multi_type")

    def test_other_kinds_alone_are_excluded(self):
        self.assertEqual(self.reason("低刺激 保湿クリーム 50ml"), "not_toner")
        self.assertEqual(self.reason("毛穴ケア クレンジングオイル"), "not_toner")
        self.assertEqual(self.reason("シートマスク 10枚"), "not_toner")

    def test_a_toner_is_not_an_essence(self):
        self.assertEqual(self.reason("エッセンストナー 200ml"), "not_toner")

    def test_option_listing_of_one_kind_is_kept_for_a_human_to_check(self):
        self.assertIsNone(self.reason("【選べる7種】ペプチドアンプルほか 毛穴・ハリ・高保湿"))

    def test_the_same_title_is_judged_by_its_own_category(self):
        self.assertIsNone(q.classify_listing("ビタミンC セラム 30ml", "serum"))
        self.assertEqual(q.classify_listing("ビタミンC セラム 30ml", "toner"), "not_toner")  # 화장수 단어 목록을 그대로 쓰면 에센스가 다 빠진다


class RankingTest(unittest.TestCase):
    def test_sets_are_skipped_and_rank_keeps_site_position(self):
        page = listing_html([("1", "A"), ("2", "B 2本セット"), ("3", "C")])
        picked, excluded = q.fetch_ranking(FakeClient(gets=[page]), "toner", top_n=2)
        self.assertEqual([(p["gd_no"], p["rank"]) for p in picked], [("1", 1), ("3", 3)])
        self.assertEqual([(e["gd_no"], e["rank"], e["reason"]) for e in excluded], [("2", 2, "set")])

    def test_excluded_listings_are_recorded_with_reason_and_do_not_use_up_top_n(self):
        page = listing_html([("1", "保湿 化粧水 200ml"), ("2", "洗顔クレンジング"), ("3", "シリーズ 化粧水/乳液/美容液"), ("4", "鎮静 トナー 150ml")])
        picked, excluded = q.fetch_ranking(FakeClient(gets=[page]), "toner", top_n=2)
        self.assertEqual([(p["gd_no"], p["rank"]) for p in picked], [("1", 1), ("4", 4)])
        self.assertEqual([(e["gd_no"], e["rank"], e["reason"]) for e in excluded], [("2", 2, "not_toner"), ("3", 3, "multi_type")])
        self.assertEqual(set(excluded[0]), {"rank", "gd_no", "title", "brand", "url", "reason"})

    def test_unknown_category_is_rejected(self):
        with self.assertRaises(ValueError):
            q.listing_url("cream", 1)

    def test_essence_category_address_is_the_sibling_of_toner(self):
        self.assertIn("120000012/220000159/320001623", q.listing_url("serum", 1))
        self.assertIn("120000012/220000159/320001619", q.listing_url("toner", 1))


class CollectTest(unittest.TestCase):
    def test_one_product_failure_does_not_stop_the_others(self):
        client = FakeClient(
            gets=[listing_html([("1", "A"), ("2", "B")]), summary_html(), summary_html()],
            posts=[requests.ConnectionError("boom"), review_html([("7", 1)])],
        )
        result = q.collect("toner", top_n=2, stars=[1], limit=10, client=client)
        self.assertEqual([p["status"] for p in result["products"]], ["failed", "done"])
        self.assertEqual([r["external_id"] for r in result["reviews"]], ["7"])
        self.assertEqual(result["reviews"][0]["product_gd_no"], "2")

    def test_blocked_stops_everything_and_keeps_partial_result(self):
        client = FakeClient(
            gets=[listing_html([("1", "A"), ("2", "B")]), summary_html(), summary_html()],
            posts=[review_html([("7", 1)]), q.BlockedError("403")],
        )
        result = q.collect("toner", top_n=2, stars=[1], limit=10, client=client)
        self.assertIn("aborted", result["meta"])
        self.assertEqual(len(result["reviews"]), 1)  # 막히기 전까지 모은 것은 남긴다

    def test_run_over_budget_fails_only_that_product(self):
        with mock.patch.object(q, "MAX_REQUESTS_PER_PRODUCT", 2):
            fake = PagedFake(sorted_list(s1=100000, s5=10), gets=[listing_html([("1", "A")]), summary_html()])
            result = q.collect("toner", top_n=1, stars=[5], limit=5, client=fake)
        self.assertEqual(result["products"][0]["status"], "failed")
        self.assertIn("요청이", result["products"][0]["error"])


class CollectStateTest(unittest.TestCase):
    def _run(self, saved: set[str], known: set[str]):
        client = FakeClient(
            gets=[
                listing_html([("1", "A"), ("2", "B"), ("3", "C")]),
                summary_html("500"),
                summary_html("40"),
                summary_html("9,999"),
            ],
            posts=[
                review_html([("a", 1), ("b", 1)]),  # 제품 1: 1점 2건
                review_html([("d", 1)]),  # 제품 2
                review_html([("e", 1)]),  # 제품 3
            ],
        )
        result = q.collect("toner", top_n=3, stars=[1], limit=50, known_ids=known, saved_products=saved, client=client)
        return result["products"]

    def test_three_states_and_site_numbers(self):
        products = self._run(saved={"1", "2"}, known={"a", "b", "d"})
        by = {p["gd_no"]: p for p in products}
        self.assertEqual(by["1"]["save_state"], "fully_saved")  # 이력 있음, 읽은 2건이 모두 이미 저장됨
        self.assertEqual(by["2"]["save_state"], "fully_saved")
        self.assertEqual(by["3"]["save_state"], "not_saved")  # 이력 없음
        self.assertEqual((by["1"]["site_total_count"], by["1"]["site_low_count"], by["1"]["low_count_exact"]), (500, 2, True))
        self.assertEqual(by["3"]["site_total_count"], 9999)
        self.assertEqual(by["1"]["stars"]["1"]["exhausted"], True)

    def test_partly_saved_when_a_new_review_appeared(self):
        products = self._run(saved={"1"}, known={"a"})  # b가 새로 생김
        self.assertEqual(products[0]["save_state"], "partly_saved")
        self.assertEqual(products[0]["collected"], 1)

    def test_callers_known_ids_are_not_modified(self):
        known = {"a"}
        self._run(saved=set(), known=known)
        self.assertEqual(known, {"a"})


class ClientTest(unittest.TestCase):
    def _client(self, status: int = 200, text: str = "ok"):
        response = mock.Mock(status_code=status, text=text)
        response.raise_for_status.side_effect = None if status < 400 else requests.HTTPError(str(status))
        session = mock.Mock(headers={}, request=mock.Mock(return_value=response))
        sleeps: list[float] = []
        client = q.Client(session=session, sleep=sleeps.append, uniform=lambda lo, hi: (lo + hi) / 2)
        return client, session, sleeps

    def test_waits_2_to_5_seconds_between_requests_but_not_before_the_first(self):
        client, _, sleeps = self._client()
        client.get("https://example.test/a")
        self.assertEqual(sleeps, [])
        client.get("https://example.test/b")
        self.assertEqual(len(sleeps), 1)
        self.assertTrue(q.DELAY_RANGE[0] >= 2.0 and q.DELAY_RANGE[1] > q.DELAY_RANGE[0])

    def test_blocked_statuses_raise_instead_of_retrying(self):
        for status in (403, 429):
            client, session, _ = self._client(status=status)
            with self.assertRaises(q.BlockedError):
                client.get("https://example.test/a")
            self.assertEqual(session.request.call_count, 1)

    def test_captcha_page_raises(self):
        client, _, _ = self._client(text="<html>Please solve the CAPTCHA</html>")
        with self.assertRaises(q.BlockedError):
            client.get("https://example.test/a")

    def test_post_sends_content_length_zero(self):
        client, session, _ = self._client()
        client.post_empty("https://example.test/p", "https://example.test/r")
        headers = session.request.call_args.kwargs["headers"]
        self.assertEqual(headers["Content-Length"], "0")


if __name__ == "__main__":
    unittest.main()
