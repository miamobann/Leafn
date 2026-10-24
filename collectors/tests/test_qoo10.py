"""Qoo10 수집기 테스트 — 목록 · 제품 요약 · 제외 규칙. 네트워크를 쓰지 않고, 가짜 문장으로 만든 HTML만 쓴다 (실제 리뷰 원문은 넣지 않는다).

실행 (저장소 루트에서): python -m unittest discover -s collectors/tests -t .
"""

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


class ParseTest(unittest.TestCase):
    def test_listing_reads_number_brand_title_and_flags_sets(self):
        items = q.parse_listing(listing_html([("111", "化粧水 200ml"), ("222", "化粧水 2本セット")]))
        self.assertEqual([i["gd_no"] for i in items], ["111", "222"])
        self.assertEqual(items[0]["brand"], "ブランド111")  # "公式" 표시는 브랜드명에서 뺀다
        self.assertEqual([i["is_set"] for i in items], [False, True])

    def test_empty_html_gives_no_items(self):
        self.assertEqual(q.parse_listing(""), [])


class SummaryTest(unittest.TestCase):
    def test_reads_total_count_and_average(self):
        self.assertEqual(q.parse_summary(summary_html()), {"total_count": 143807, "avg_rating": 4.6})

    def test_unreadable_page_gives_none_instead_of_failing(self):
        self.assertEqual(q.parse_summary("<p>x</p>"), {"total_count": None, "avg_rating": None})

    def test_fetch_summary_reads_the_reviews_page(self):
        got = q.fetch_summary(FakeClient(gets=[summary_html("1,234")]), "999")
        self.assertEqual(got["total_count"], 1234)
        self.assertIn("goodscode=999", q.summary_url("999"))


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
        self.assertIsNone(q.classify_listing("洗顔クレンジング", "serum"))
        self.assertEqual(q.classify_listing("2本セット 美容液", "serum"), "set")


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
            q.listing_url("serum", 1)


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
