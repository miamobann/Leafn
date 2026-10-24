"""Qoo10 일본(www.qoo10.jp) 리뷰 수집기 — 카테고리 목록 · 제품 요약 · 비교 대상 가리기.

흐름: 카테고리 목록(리뷰 많은 순) → 제품 번호(gd_no). 목록에는 세트, 여러 종류를 함께 파는 시리즈, 클렌징·크림 같은 다른 종류가 섞여 있어서
제목으로 확실한 것만 빼고(classify_listing) 이유를 남긴다. 제품별 리뷰 읽기와 전체 실행은 다음 PR에서 이어진다.

규칙
- 요청마다 2~5초 무작위로 쉰다 (robots.txt Crawl-delay 2초 이상). 사이트 부담을 줄이려는 간격이다.
- 쿠키·로그인을 쓰지 않는다. 403·429·캡차가 보이면 우회하지 않고 바로 멈춘다 (BlockedError).
- 약관: 이 수집은 팀과 강사 합의 아래 소량만 한다 (CLAUDE.md 8장). 한도를 늘리기 전에 팀에 먼저 알린다.
"""

from __future__ import annotations

import random
import re
import time
from typing import Any, Callable

import requests
from bs4 import BeautifulSoup

BASE = "https://www.qoo10.jp"
# 카테고리 경로. 美容液(에센스)는 목록 주소를 확인한 뒤 추가한다 (추측해서 넣지 않는다).
CATEGORIES = {"toner": "120000012/220000159/320001619"}
LIST_PAGE_SIZE = 40
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
TARGET_TYPE = {"toner": "toner"}  # 수집 카테고리 → 비교 대상 종류
EXCLUDE_REASONS = ("set", "multi_type", "not_toner")  # 세트·기획 상품 / 여러 종류를 함께 파는 상품 / 대상 종류가 아닌 제품


def classify_listing(title: str, category: str) -> str | None:
    """비교 대상이 아니면 이유(EXCLUDE_REASONS 중 하나), 대상이면 None. 제목만 보는 단순 규칙이라 틀릴 수 있다."""
    if SET_PATTERN.search(title):
        return "set"
    target = TARGET_TYPE.get(category)
    if target is None:
        return None
    text = TONER_COMPOUND.sub("トナー", title)
    kinds = {name for name, pattern in TYPE_WORDS.items() if re.search(pattern, text)}
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
