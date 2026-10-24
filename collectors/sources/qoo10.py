"""Qoo10 일본(www.qoo10.jp) 리뷰 수집기.

흐름: 카테고리 목록(리뷰 많은 순) → 제품 번호(gd_no) → 제품별 리뷰 목록(낮은 별점순)
리뷰 화면의 선택(카테고리 · TOP N · 별점 체크박스 · 별점마다 새로 가져올 건수)이 collect()의 인자와 1:1로 대응한다.

리뷰 읽는 방법 (2026-10-24 실험으로 확인): 목록은 낮은 별점부터 1→2→3→4→5로 끊김 없이 이어지고, 페이지를 멀리 건너뛰어 열 수 있으며,
같은 별점 안에서는 최신순이다. 그래서 체크한 별점마다 "그 별점이 시작하는 페이지"를 찾아(find_start_page) 건너뛰고,
이미 가진 리뷰는 건너뛰면서 아직 없는 리뷰를 최신순으로 N건 모은다(read_star). 체크하지 않은 별점은 읽지 않는다.

실행 (저장소 루트에서):
    python -m collectors.sources.qoo10 --category toner --top-n 10 --stars 3 --limit 20

규칙
- 요청마다 2~5초 무작위로 쉰다 (robots.txt Crawl-delay 2초 이상). 사이트 부담을 줄이려는 간격이다.
- 쿠키·로그인을 쓰지 않는다. 403·429·캡차가 보이면 우회하지 않고 바로 멈춘다 (BlockedError).
- 이미 가진 리뷰 id(--known-ids)는 저장하지 않는다. 목록은 페이지 단위라 id를 보려면 읽어야 하므로 요청은 한다.
- 제품 하나에서 요청이 MAX_REQUESTS_PER_PRODUCT를 넘으면 그 제품은 멈춘다 (위치 찾기가 길을 잃어도 사이트를 두드리지 않게).
- 제품 하나가 실패해도 다음 제품은 계속한다. 웹앱과는 DB로만 연결한다 (지금은 DB 테이블이 없어 JSON 파일로 출력).
- 약관: 이 수집은 팀과 강사 합의 아래 소량만 한다 (CLAUDE.md 8장). 한도를 늘리기 전에 팀에 먼저 알린다.
"""

from __future__ import annotations

import argparse
import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import requests
from bs4 import BeautifulSoup

BASE = "https://www.qoo10.jp"
# 카테고리 경로. 에센스(美容液)는 기초화장품(120000012/220000159)의 형제 카테고리이고, 사이트 메뉴에서 직접 확인한 코드다 (추측하지 않는다).
CATEGORIES = {"toner": "120000012/220000159/320001619", "serum": "120000012/220000159/320001623"}
LIST_PAGE_SIZE = 40
REVIEW_PAGE_SIZE = 20  # 한 번에 20건이 되는 것을 실험으로 확인했다 (2026-10-24)
MAX_REQUESTS_PER_PRODUCT = 80  # 한 제품에서 새로 연 페이지 수의 상한 (위치 찾기 약 11 + 읽기 몇 번이면 충분하다)
MAX_LIST_PAGES = 5
DELAY_RANGE = (2.0, 5.0)
USER_AGENT = "LeafnReviewCollector/0.1 (student project; +https://github.com/miamobann/Leafn)"

# 세트·기획 상품은 비교 대상으로 부적합하다. 제목 글자로 거르는 단순 규칙이라 완벽하지 않다.
SET_PATTERN = re.compile(r"セット|\bset\b|[2-9]本|[2-9]個|福袋|まとめ買い", re.IGNORECASE)
BLOCK_PATTERN = re.compile(r"captcha|access denied", re.IGNORECASE)

# 비교 대상이 아닌 목록을 제목으로 가른다. 카테고리(化粧水) 안에도 "화장수·세럼·크림 중 고르는 시리즈" 같은 상품이 섞여 있고,
# 사이트가 상품 종류를 따로 알려 주지 않기 때문이다. 틀릴 수 있어서 확실한 것만 빼고(아래 이유 셋),
# 애매한 것(옵션 · 시리즈 표기)은 남겨 화면에서 사람이 고르게 한다. 단어 목록은 팀이 정할 일이라 이 한 곳에서만 고친다 (팀 합의 전 시안).
TYPE_WORDS = {
    "toner": r"化粧水|トナー|ローション|拭き取り|ミスト",
    "cleanser": r"クレンジング|洗顔",
    "cream": r"クリーム(?!ミー|スキン)|乳液|オールインワン",  # クリームスキン은 제품 이름이다
    "serum": r"美容液|アンプル|セラム(?!トナー)",  # 에센스는 에센스형 토너도 있어서 종류 단어에서 뺀다
    "mask": r"マスク|パック",
}
TONER_COMPOUND = re.compile(r"(エッセンス|セラム|クリーミー)トナー")  # 이름에 다른 종류 단어가 들어 있어도 토너다
# 에센스 카테고리에서는 エッセンス · ショット · ブースター도 에센스 단어다 (화장수 쪽에서는 에센스형 토너 때문에 뺐지만, 여기서는 대상 종류다).
TYPE_WORDS_SERUM = {**TYPE_WORDS, "serum": r"美容液|アンプル|セラム|エッセンス|ショット|ブースター"}
WORDS_BY_CATEGORY = {"toner": TYPE_WORDS, "serum": TYPE_WORDS_SERUM}
TARGET_TYPE = {"toner": "toner", "serum": "serum"}  # 수집 카테고리 → 비교 대상 종류
# not_toner는 "수집 카테고리의 대상 종류가 아님"이라는 뜻이다 (에센스 카테고리에서도 같은 값을 쓴다. DB의 check 값을 바꾸지 않으려고 이름을 그대로 둠).
EXCLUDE_REASONS = ("set", "multi_type", "not_toner")  # 세트·기획 상품 / 여러 종류를 함께 파는 상품 / 대상 종류가 아닌 제품


def classify_listing(title: str, category: str) -> str | None:
    """비교 대상이 아니면 이유(EXCLUDE_REASONS 중 하나), 대상이면 None. 제목만 보는 단순 규칙이라 틀릴 수 있다."""
    if SET_PATTERN.search(title):
        return "set"
    target = TARGET_TYPE.get(category)
    if target is None:
        return None
    text = TONER_COMPOUND.sub("トナー", title)
    words = WORDS_BY_CATEGORY.get(category, TYPE_WORDS)
    kinds = {name for name, pattern in words.items() if re.search(pattern, text)}
    if len(kinds) >= 2:
        return "multi_type"
    if kinds and target not in kinds:
        return "not_toner"
    return None


class BlockedError(Exception):
    """사이트가 접근을 막았다 (403·429·캡차). 우회하지 않고 전체 수집을 멈춘다."""


class Client:
    """요청 사이에 2~5초 무작위로 쉬는 HTTP 클라이언트. 쿠키는 쓰지 않는다."""

    def __init__(
        self,
        session: requests.Session | None = None,
        sleep: Callable[[float], None] = time.sleep,
        uniform: Callable[[float, float], float] = random.uniform,
    ) -> None:
        self.session = session or requests.Session()
        self.session.headers["User-Agent"] = USER_AGENT
        self._sleep = sleep
        self._uniform = uniform
        self.requests_made = 0

    def _send(self, method: str, url: str, **kwargs: Any) -> str:
        if self.requests_made:
            self._sleep(self._uniform(*DELAY_RANGE))
        resp = self.session.request(method, url, timeout=30, **kwargs)
        self.requests_made += 1
        resp.encoding = "utf-8"
        if resp.status_code in (403, 429) or BLOCK_PATTERN.search(resp.text[:5000]):
            raise BlockedError(f"{method} {url} -> HTTP {resp.status_code}")
        resp.raise_for_status()
        return resp.text

    def get(self, url: str) -> str:
        return self._send("GET", url)

    def post_empty(self, url: str, referer: str) -> str:
        # 이 주소는 본문 없는 POST에 Content-Length: 0이 없으면 411을 돌려준다
        headers = {"Content-Length": "0", "Origin": BASE, "Referer": referer}
        return self._send("POST", url, headers=headers)


# ---- 목록 (카테고리, 리뷰 많은 순) ----


def listing_url(category: str, page: int) -> str:
    path = CATEGORIES.get(category)
    if path is None:
        raise ValueError(f"아직 지원하지 않는 카테고리예요: {category} (지원: {', '.join(CATEGORIES)})")
    return (
        f"{BASE}/cat/{path}?sortType=MOST_REVIEWED&dispType=UIG5"
        f"&curPage={page}&pageSize={LIST_PAGE_SIZE}&partial=on"
    )


def parse_listing(html: str) -> list[dict[str, Any]]:
    """목록 한 페이지에서 제품 카드를 읽는다. 순서는 사이트가 보여 준 순서 그대로다."""
    soup = BeautifulSoup(html, "html.parser")
    items: list[dict[str, Any]] = []
    for li in soup.select("#search_result_item_list > li[goodscode]"):
        title_a = li.select_one("a.tt")
        brand_a = li.select_one("a.txt_brand")
        title = title_a.get("title", "").strip() if title_a else ""
        brand = ""
        if brand_a:
            official = brand_a.select_one(".official")
            if official:
                official.extract()
            brand = brand_a.get_text(" ", strip=True)
        items.append(
            {
                "gd_no": str(li["goodscode"]),
                "title": title,
                "brand": brand,
                "url": title_a.get("href", "") if title_a else "",
                "is_set": bool(SET_PATTERN.search(title)),
                # 'goods_power' 등 사이트 내부 분류. 광고인지는 확인되지 않아 그대로 기록만 한다
                "listing_type": li.get("ga-product", ""),
            }
        )
    return items


def fetch_ranking(client: Client, category: str, top_n: int) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """리뷰 많은 순 상위 top_n개. 비교 대상이 아닌 목록(classify_listing)은 빼고 센다.

    (제품 목록, 뺀 목록)을 돌려준다. 순위(rank)는 사이트가 보여 준 위치 그대로라서 뺀 자리는 비어 있다.
    뺀 목록에는 이유(reason)를 남겨 화면에서 사람이 확인할 수 있게 한다.
    """
    picked: list[dict[str, Any]] = []
    excluded: list[dict[str, Any]] = []
    position = 0
    for page in range(1, MAX_LIST_PAGES + 1):
        items = parse_listing(client.get(listing_url(category, page)))
        if not items:
            break
        for item in items:
            position += 1
            reason = classify_listing(item["title"], category)
            if reason:
                excluded.append({"rank": position, "gd_no": item["gd_no"], "title": item["title"], "brand": item["brand"], "url": item["url"], "reason": reason})
                continue
            picked.append({**item, "rank": position})
            if len(picked) >= top_n:
                return picked, excluded
        if len(items) < LIST_PAGE_SIZE:
            break
    return picked, excluded


# ---- 제품 요약 (사이트가 표시하는 전체 리뷰 수) ----


def summary_url(gd_no: str) -> str:
    return f"{BASE}/gmkt.inc/Mobile/My/Reviews.aspx?goodscode={gd_no}&contents_cnt=0&iflyyn=Y&noheader=Y"


def parse_summary(html: str) -> dict[str, Any]:
    """리뷰 화면 위쪽의 '4.6 ( 143,807 件のレビュー)'를 읽는다. 목록 카드는 999+로 잘려 있어 쓰지 않는다.

    사이트가 표시하는 값이라 사진·체험 후기가 섞여 있을 수 있다. 못 읽으면 None (수집은 계속한다).
    """
    soup = BeautifulSoup(html, "html.parser")
    count_el = soup.select_one(".review_aigrade .rate_count")
    score_el = soup.select_one(".review_aigrade .rate_score")
    count = re.search(r"\d[\d,]*", count_el.get_text()) if count_el else None
    score = re.search(r"\d+(?:\.\d+)?", score_el.get_text()) if score_el else None
    return {
        "total_count": int(count.group(0).replace(",", "")) if count else None,
        "avg_rating": float(score.group(0)) if score else None,
    }


def fetch_summary(client: Client, gd_no: str) -> dict[str, Any]:
    return parse_summary(client.get(summary_url(gd_no)))


# ---- 리뷰 (제품별, 낮은 별점순) ----


def review_url(gd_no: str, page: int) -> tuple[str, str]:
    url = (
        f"{BASE}/gmkt.inc/Mobile/My/ReviewsAppend.aspx?gd_no={gd_no}&group_code=2&tagCd=&option="
        f"&page_no={page}&page_size={REVIEW_PAGE_SIZE}&sort_type=L&contents_cnt=0"
    )
    return url, summary_url(gd_no)


def parse_reviews(html: str) -> list[dict[str, Any]]:
    """리뷰 목록 조각(HTML)에서 리뷰를 읽는다. 연령대는 Qoo10에 없다."""
    soup = BeautifulSoup(html, "html.parser")
    reviews: list[dict[str, Any]] = []
    for head in soup.select("div.detail_reviewstar"):
        li = head.find_parent("li")
        like = li.select_one("button[id^=like_R_]") if li else None
        value = head.select_one(".reviewstar_ratecnt .value")
        if li is None or like is None or value is None:
            continue  # 구조가 다른 조각은 건너뛴다
        spans = [s.get_text(strip=True) for s in head.select(".reviewstar_text span")]
        author = spans[0] if spans else ""
        posted = spans[1] if len(spans) > 1 else ""

        options: dict[str, str] = {}
        for span in li.select(".option_type"):
            key, sep, val = span.get_text(" ", strip=True).partition(":")
            if sep:
                options[key.strip()] = val.strip()

        aspects = []
        for wrap in li.select(".content_review .review_wrap"):
            name = wrap.select_one("span")
            if name:
                verdict = wrap.get_text(" ", strip=True).replace(name.get_text(strip=True), "", 1).strip()
                aspects.append({"aspect": name.get_text(strip=True), "verdict": verdict})

        body_el = li.select_one(".content_text")
        body = body_el.get_text("\n", strip=True) if body_el else ""
        likes = like.get_text(strip=True)
        reviews.append(
            {
                "external_id": like["id"].removeprefix("like_R_"),
                "rating": int(value.get_text(strip=True)),
                "body": body,
                "posted_at": posted.replace(".", "-") if re.fullmatch(r"\d{4}\.\d{2}\.\d{2}", posted) else None,
                "raw": {
                    "author_masked": author,
                    "options": options,
                    "aspects": aspects,
                    "likes": int(likes) if likes.isdigit() else 0,
                },
            }
        )
    return reviews


class ReviewPages:
    """한 제품의 낮은 별점순 리뷰 페이지. 같은 페이지는 한 번만 요청한다 (위치 찾기에서 연 페이지를 읽기에서 다시 쓴다)."""

    def __init__(self, client: Client, gd_no: str, budget: int | None = None) -> None:
        self.client, self.gd_no = client, gd_no
        self.budget = MAX_REQUESTS_PER_PRODUCT if budget is None else budget  # 만들 때 읽는다 (값을 바꿔도 반영되게)
        self.cache: dict[int, list[dict[str, Any]]] = {}

    def get(self, page: int) -> list[dict[str, Any]]:
        if page not in self.cache:
            if len(self.cache) >= self.budget:
                raise ValueError(f"제품 하나에서 요청이 {self.budget}번을 넘어 멈췄어요")
            url, referer = review_url(self.gd_no, page)
            self.cache[page] = parse_reviews(self.client.post_empty(url, referer))
        return self.cache[page]


def reaches(pages: ReviewPages, page: int, star: int) -> bool:
    """이 페이지의 마지막 리뷰가 star점 이상인가. 페이지가 비었으면(목록 끝을 넘음) 그렇다고 본다."""
    rows = pages.get(page)
    return not rows or rows[-1]["rating"] >= star


def find_start_page(pages: ReviewPages, star: int, after: int = 0) -> int | None:
    """star점이 처음 나오는 페이지(그 페이지에 앞 별점이 섞여 있을 수 있다). 이 제품에 star점 이상이 없으면 None.

    낮은 별점순이라 '마지막 리뷰가 star점 이상'은 페이지 번호가 커질수록 거짓에서 참으로 한 번만 바뀐다.
    after는 '마지막 리뷰가 star점 미만'이라고 이미 아는 가장 큰 페이지(없으면 0). 먼저 1, 3, 7, 15…로 늘려 가며 열어서 참인 곳을 찾고
    그 사이를 반으로 좁힌다. 낮은 별점은 드물어서 보통 앞쪽에 있으니 늘려 가는 방식이 처음부터 반으로 가르는 것보다 적게 든다.
    """
    if star <= 1:
        return 1
    lo, step = after, 1
    while True:
        probe = lo + step
        if reaches(pages, probe, star):
            hi = probe
            break
        lo, step = probe, step * 2
    while hi - lo > 1:
        mid = (lo + hi) // 2
        if reaches(pages, mid, star):
            hi = mid
        else:
            lo = mid
    return hi if pages.get(hi) else None


def read_star(
    pages: ReviewPages, star: int, start: int, quota: int, known_ids: set[str]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """start 페이지부터 star점 리뷰를 최신순으로 읽어, 아직 없는 리뷰를 quota건 모은다. 이미 가진 리뷰는 건너뛴다.

    exhausted=True면 이 별점 구간 끝(더 높은 별점이 나오거나 목록이 끝남)까지 읽었다는 뜻이고, 그때 read는 이 별점의 정확한 리뷰 수다.
    quota에 먼저 닿아 멈췄으면 exhausted=False (더 있을 수 있다).
    """
    collected: list[dict[str, Any]] = []
    read = skipped_known = 0
    page = start
    exhausted = True
    while True:
        rows = pages.get(page)
        for review in rows:
            if review["rating"] > star:  # 낮은 별점순이라 이후는 모두 더 높다
                return collected, _star_info(read, skipped_known, len(collected), True)
            if review["rating"] < star:  # 시작 페이지에 섞여 있는 앞 별점
                continue
            read += 1
            if review["external_id"] in known_ids:
                skipped_known += 1
                continue
            collected.append(review)
            if len(collected) >= quota:
                return collected, _star_info(read, skipped_known, len(collected), False)
        if len(rows) < REVIEW_PAGE_SIZE:  # 마지막 페이지
            break
        page += 1
    return collected, _star_info(read, skipped_known, len(collected), exhausted)


def _star_info(read: int, skipped_known: int, new: int, exhausted: bool) -> dict[str, Any]:
    return {"read": read, "skipped_known": skipped_known, "new": new, "exhausted": exhausted}


def collect_stars(
    client: Client, gd_no: str, stars: list[int], quota: int, known_ids: set[str]
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """체크한 별점마다 별점의 시작 위치로 건너뛰어, 아직 없는 최신 리뷰를 quota건씩 모은다. 체크하지 않은 별점은 읽지 않는다.

    돌려주는 info: read(읽은 선택 별점 리뷰 수, 이미 가진 것 포함) · skipped_known · stop · low_count · low_count_exact(모든 별점이 끝까지 읽혔는가)
    · stars(별점별 결과 {"3": {start_page, read, skipped_known, new, exhausted}}) · requests(이 제품에서 연 페이지 수)
    """
    pages = ReviewPages(client, gd_no)
    collected: list[dict[str, Any]] = []
    per_star: dict[str, dict[str, Any]] = {}
    after = 0
    missing = False  # 앞 별점에서 '이 별점 이상이 없다'가 확인되면 더 높은 별점도 없다
    for star in sorted(set(stars)):
        if missing:
            per_star[str(star)] = {"start_page": None, **_star_info(0, 0, 0, True)}
            continue
        start = find_start_page(pages, star, after)
        if start is None:
            missing = True
            per_star[str(star)] = {"start_page": None, **_star_info(0, 0, 0, True)}
            continue
        after = max(after, start - 1)
        got, info = read_star(pages, star, start, quota, known_ids)
        collected.extend(got)
        per_star[str(star)] = {"start_page": start, **info}
    read = sum(i["read"] for i in per_star.values())
    all_exhausted = all(i["exhausted"] for i in per_star.values())
    return collected, {
        "read": read,
        "skipped_known": sum(i["skipped_known"] for i in per_star.values()),
        "stop": "max_star" if all_exhausted else "limit",
        "low_count": read,
        "low_count_exact": all_exhausted,
        "stars": per_star,
        "requests": len(pages.cache),
    }


def save_state(has_history: bool, new_count: int) -> str:
    """화면에 띄울 저장 상태. 리뷰 번호로 센 '새로 저장할 수 있는 수'(new_count)로 정한다.

    not_saved    이전에 저장한 적이 없는 제품
    partly_saved 저장한 적이 있고, 새로 저장할 수 있는 리뷰가 있다
    fully_saved  저장한 적이 있고, 새로 저장할 수 있는 리뷰가 없다
    """
    if not has_history:
        return "not_saved"
    return "partly_saved" if new_count > 0 else "fully_saved"


# ---- 전체 실행 ----


def collect(
    category: str,
    top_n: int,
    stars: list[int],
    limit: int,
    known_ids: set[str] | None = None,
    saved_products: set[str] | None = None,
    client: Client | None = None,
    log: Callable[[str], None] = lambda _msg: None,
) -> dict[str, Any]:
    """stars: 가져올 별점(예: [3] 또는 [1, 2, 3]). limit: 별점마다 새로 가져올 건수. 이미 가진 리뷰(known_ids)는 세지 않는다.

    saved_products: 이전에 리뷰를 저장한 적이 있는 제품 번호(gd_no). 저장 상태(save_state)를 정하는 데 쓴다.
    """
    client = client or Client()
    known = set(known_ids or ())  # 호출한 쪽의 집합을 바꾸지 않는다
    saved = saved_products or set()
    result: dict[str, Any] = {
        "meta": {
            "source": "qoo10",
            "category": category,
            "sort": "MOST_REVIEWED",
            "top_n": top_n,
            "stars": sorted(set(stars)),
            "limit": limit,
            "captured_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        },
        "products": [],
        "reviews": [],
        "excluded": [],
    }
    try:
        products, excluded = fetch_ranking(client, category, top_n)
        result["meta"]["skipped"] = len(excluded)
        result["excluded"] = excluded
        for product in products:
            log(f"[{product['rank']}위] {product['gd_no']} {product['title'][:30]}")
            status: dict[str, Any] = {**product, "status": "failed", "error": None}
            try:
                summary = fetch_summary(client, product["gd_no"])
                reviews, info = collect_stars(client, product["gd_no"], stars, limit, known)
                for review in reviews:
                    result["reviews"].append({"product_gd_no": product["gd_no"], "lang": "ja", **review})
                known.update(r["external_id"] for r in reviews)
                status.update(
                    info,
                    status="done",
                    collected=len(reviews),
                    site_total_count=summary["total_count"],
                    site_avg_rating=summary["avg_rating"],
                    site_low_count=info["low_count"],
                    save_state=save_state(product["gd_no"] in saved, len(reviews)),
                )
            except BlockedError:
                raise
            except (requests.RequestException, ValueError) as err:  # 이 제품만 실패, 다음 제품은 계속
                status.update(error=str(err)[:200], collected=0)
                log(f"  ! 실패: {err}")
            result["products"].append(status)
    except BlockedError as err:
        result["meta"]["aborted"] = f"접근이 막혀 멈췄어요: {err}"
        log(f"! {result['meta']['aborted']}")
    result["meta"]["requests_made"] = client.requests_made
    return result


def parse_stars(text: str) -> list[int] | None:
    """"3" 또는 "1,2,3"을 [1, 2, 3]으로. 1~5가 아니거나 비었으면 None."""
    try:
        stars = sorted({int(part) for part in text.split(",") if part.strip()})
    except ValueError:
        return None
    return stars if stars and all(1 <= star <= 5 for star in stars) else None


def main() -> int:
    parser = argparse.ArgumentParser(description="Qoo10 일본 리뷰 수집 (소량, 로컬 실행)")
    parser.add_argument("--category", choices=sorted(CATEGORIES), default="toner")
    parser.add_argument("--top-n", type=int, default=10, help="리뷰 많은 순 상위 N개 제품 (세트 상품 제외)")
    parser.add_argument("--stars", default="3", help="가져올 별점. 쉼표로 여러 개 (예: 3 또는 1,2,3)")
    parser.add_argument("--limit", type=int, default=20, help="별점마다 새로 가져올 리뷰 수")
    parser.add_argument("--known-ids", type=Path, help="이미 가진 리뷰 id 목록(JSON 배열). 이 id는 저장하지 않는다")
    parser.add_argument("--saved-products", type=Path, help="이전에 저장한 적 있는 제품 번호 목록(JSON 배열)")
    parser.add_argument("--out", type=Path, help="결과 JSON 경로 (기본: collectors/data/)")
    args = parser.parse_args()
    stars = parse_stars(args.stars)
    if stars is None or not (1 <= args.top_n <= 50 and 1 <= args.limit <= 200):
        parser.error("범위: top-n 1~50, stars는 1~5 (예: 3 또는 1,2,3), limit 1~200")

    known = set(json.loads(args.known_ids.read_text(encoding="utf-8"))) if args.known_ids else set()
    saved = set(json.loads(args.saved_products.read_text(encoding="utf-8"))) if args.saved_products else set()
    result = collect(
        args.category, args.top_n, stars, args.limit, known, saved, log=lambda m: print(m, file=sys.stderr)
    )
    out = args.out or Path("collectors/data") / f"qoo10-{datetime.now():%Y%m%d-%H%M%S}.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"저장: {out} (제품 {len(result['products'])}, 리뷰 {len(result['reviews'])}, 요청 {result['meta']['requests_made']}번)")
    return 1 if "aborted" in result["meta"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
