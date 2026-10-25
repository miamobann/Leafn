"""수집기가 Supabase에 쓰는 층. 새 라이브러리 없이 requests로 REST 주소(PostgREST)를 부른다.

설정 (collectors/.env.local 또는 환경 변수. .env* 는 커밋하지 않는다)
    SUPABASE_URL=https://<프로젝트>.supabase.co
    SUPABASE_SERVICE_ROLE_KEY=...   # RLS를 우회하는 키. 브라우저·채팅·커밋 금지
    WORKSPACE_ID=...                # 어느 워크스페이스에 쓰는지. service role은 RLS를 우회하므로 코드가 반드시 채운다 (DB_RULES 4.1)

규칙
- 모든 행에 workspace_id를 넣고, 조회·삭제에도 workspace_id를 건다.
- 수집 요청(collection_runs) 하나 아래에 제품별 결과와 임시(대기) 리뷰를 쓴다. 정식 reviews로 옮기는 것은 화면의 [저장]이다.
- 오류 메시지에 키가 섞이지 않게 응답 본문만 잘라 보여 준다.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Mapping

import requests

ENV_FILE = Path(__file__).with_name(".env.local")
REQUIRED = ("SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "WORKSPACE_ID")
CHUNK = 200  # 한 번에 넣는 행 수
PAGE = 1000  # 한 번에 읽는 행 수 (PostgREST 기본 최대치)
OPEN_STATUSES = "queued,running,ready"  # 아직 저장 전인 수집 요청


class DbError(Exception):
    """DB 요청이 실패했거나 설정이 빠졌다."""


def load_settings(path: Path = ENV_FILE, environ: Mapping[str, str] | None = None) -> dict[str, str]:
    """설정 파일을 읽고, 같은 이름의 환경 변수가 있으면 그것을 우선한다 (GitHub Actions용)."""
    environ = os.environ if environ is None else environ
    values: dict[str, str] = {}
    if path.exists():
        for raw in path.read_text(encoding="utf-8-sig").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            values[key.strip()] = value.strip().strip('"').strip("'")
    for key in REQUIRED:
        if environ.get(key):
            values[key] = environ[key]
    missing = [key for key in REQUIRED if not values.get(key)]
    if missing:
        raise DbError(f"설정이 빠졌어요: {', '.join(missing)} (collectors/.env.local 또는 환경 변수)")
    values["SUPABASE_URL"] = values["SUPABASE_URL"].rstrip("/")
    return values


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---- 수집기 결과 → DB 행 (순수 함수, 네트워크 없음) ----


def product_row(run_id: str, workspace_id: str, p: dict[str, Any]) -> dict[str, Any]:
    """collect()의 제품 결과 한 건을 collection_run_products 행으로 바꾼다."""
    return {
        "workspace_id": workspace_id,
        "run_id": run_id,
        "rank": p["rank"],
        "external_id": p["gd_no"],
        "brand": p.get("brand") or "",
        "title": p["title"],
        "url": p.get("url") or None,
        "listing_type": p.get("listing_type") or None,
        "is_set": bool(p.get("is_set")),
        "status": "done" if p.get("status") == "done" else "failed",
        "read_count": p.get("read", 0),
        "skipped_known": p.get("skipped_known", 0),
        "stop_reason": p.get("stop"),
        "site_total_count": p.get("site_total_count"),
        "site_low_count": p.get("site_low_count"),
        "site_low_count_exact": p.get("low_count_exact"),
        "star_counts": p.get("stars"),
        "error": p.get("error"),
    }


def skipped_row(run_id: str, workspace_id: str, item: dict[str, Any]) -> dict[str, Any]:
    """비교 대상이 아니라 뺀 목록 한 건을 collection_run_skipped 행으로 바꾼다."""
    return {
        "workspace_id": workspace_id,
        "run_id": run_id,
        "rank": item["rank"],
        "external_id": item["gd_no"],
        "brand": item.get("brand") or "",
        "title": item["title"],
        "url": item.get("url") or None,
        "reason": item["reason"],
    }


def staged_row(workspace_id: str, run_product_id: str, review: dict[str, Any]) -> dict[str, Any]:
    """리뷰 한 건을 collection_staged_reviews 행으로 바꾼다. 제외 표시(excluded_reason)는 AI 분류 단계에서 채운다."""
    raw = review.get("raw") or {}
    skin_type = (raw.get("options") or {}).get("肌タイプ")
    posted = review.get("posted_at")
    return {
        "workspace_id": workspace_id,
        "run_product_id": run_product_id,
        "external_id": review["external_id"],
        "lang": review.get("lang", "ja"),
        "rating": review["rating"],
        "rating_scale": 5,
        "body": review["body"],
        # 날짜만 주는 사이트라 그날 0시로 둔다 (일본 시간)
        "posted_at": f"{posted}T00:00:00+09:00" if posted else None,
        "reviewer_attrs": {"skin_type": skin_type} if skin_type else None,
        "raw": raw,
    }


class Db:
    def __init__(self, settings: Mapping[str, str], session: requests.Session | None = None) -> None:
        key = settings["SUPABASE_SERVICE_ROLE_KEY"]
        self.base = settings["SUPABASE_URL"] + "/rest/v1"
        self.host = settings["SUPABASE_URL"].removeprefix("https://").removeprefix("http://")
        self.workspace_id = settings["WORKSPACE_ID"]
        self.session = session or requests.Session()
        self.session.headers.update({"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"})

    def _call(self, method: str, table: str, params: dict[str, str] | None = None, body: Any = None, prefer: str | None = None) -> Any:
        headers = {"Prefer": prefer} if prefer else {}
        data = json.dumps(body, ensure_ascii=False).encode("utf-8") if body is not None else None
        resp = self.session.request(method, f"{self.base}/{table}", params=params, data=data, headers=headers, timeout=30)
        if resp.status_code >= 400:
            raise DbError(f"{method} {table} -> HTTP {resp.status_code}: {resp.text[:300]}")
        return resp.json() if resp.text else None

    def _ws(self) -> dict[str, str]:
        return {"workspace_id": f"eq.{self.workspace_id}"}

    def select_all(self, table: str, columns: str, **filters: str) -> list[dict[str, Any]]:
        """조건에 맞는 행을 PAGE개씩 끝까지 읽는다."""
        rows: list[dict[str, Any]] = []
        while True:
            page = self._call("GET", table, {"select": columns, **self._ws(), **filters, "limit": str(PAGE), "offset": str(len(rows))})
            rows.extend(page)
            if len(page) < PAGE:
                return rows

    # ---- 읽기 ----

    def find_own_product(self, name: str) -> dict[str, Any]:
        rows = self.select_all("products", "id,name", kind="eq.own", name=f"eq.{name}")
        if rows:
            return rows[0]
        own = [r["name"] for r in self.select_all("products", "name", kind="eq.own")]
        raise DbError(f"자사 제품 '{name}'을 못 찾았어요. 이 워크스페이스의 자사 제품: {own or '없음'}")

    def history(self, platform_id: str) -> tuple[set[str], set[str]]:
        """(이미 저장한 리뷰 번호, 저장한 적 있는 제품 번호)."""
        reviews = self.select_all("reviews", "external_id", source=f"eq.{platform_id}")
        products = self.select_all("products", "external_id", platform_id=f"eq.{platform_id}", kind="eq.competitor", external_id="not.is.null")
        return {r["external_id"] for r in reviews}, {p["external_id"] for p in products}

    # ---- 쓰기 ----

    def delete_open_runs(self, own_product_id: str) -> int:
        """같은 자사 제품의 저장 전 수집 요청을 지운다 (임시 결과가 쌓이지 않게. 제품별 결과와 임시 리뷰도 함께 지워진다)."""
        gone = self._call(
            "DELETE", "collection_runs",
            {**self._ws(), "own_product_id": f"eq.{own_product_id}", "status": f"in.({OPEN_STATUSES})", "select": "id"},
            prefer="return=representation",
        )
        return len(gone or [])

    def create_run(self, platform_id: str, category: str, own_product_id: str, top_n: int, stars: list[int], review_limit: int) -> str:
        row = {
            "workspace_id": self.workspace_id, "platform_id": platform_id, "category": category, "own_product_id": own_product_id,
            "top_n": top_n, "stars": stars, "max_star": max(stars), "review_limit": review_limit, "status": "running", "started_at": now_iso(),
        }
        return self._call("POST", "collection_runs", body=row, prefer="return=representation")[0]["id"]

    def update_run(self, run_id: str, **fields: Any) -> None:
        self._call("PATCH", "collection_runs", {**self._ws(), "id": f"eq.{run_id}"}, fields)

    # ---- 일꾼(worker) 모드: 화면이 만든 대기(queued) 요청을 집어 간다 ----

    def next_queued_run(self) -> dict[str, Any] | None:
        rows = self._call("GET", "collection_runs", {**self._ws(), "status": "eq.queued", "order": "created_at.asc", "limit": "1", "select": "*"})
        return rows[0] if rows else None

    def claim_run(self, run_id: str) -> bool:
        """대기 요청을 수집 중(running)으로 바꿔 내 것으로 한다. 다른 일꾼이 먼저 집어 갔으면 False (status=queued 조건이 겹침을 막는다)."""
        got = self._call(
            "PATCH", "collection_runs", {**self._ws(), "id": f"eq.{run_id}", "status": "eq.queued", "select": "id"},
            {"status": "running", "started_at": now_iso()}, prefer="return=representation",
        )
        return bool(got)

    def fail_stale_runs(self, older_than: str) -> int:
        """수집 중인데 older_than(ISO 시각)보다 오래 소식이 없는 요청을 실패로 바꾼다 (일꾼이 도중에 꺼진 경우)."""
        got = self._call(
            "PATCH", "collection_runs", {**self._ws(), "status": "eq.running", "started_at": f"lt.{older_than}", "select": "id"},
            {"status": "failed", "finished_at": now_iso(), "error": "수집기가 도중에 멈춘 것 같아요. 다시 불러와 주세요"}, prefer="return=representation",
        )
        return len(got or [])

    def add_run_product(self, run_id: str, p: dict[str, Any]) -> str:
        return self._call("POST", "collection_run_products", body=product_row(run_id, self.workspace_id, p), prefer="return=representation")[0]["id"]

    def add_skipped(self, run_id: str, items: list[dict[str, Any]]) -> None:
        rows = [skipped_row(run_id, self.workspace_id, i) for i in items]
        for start in range(0, len(rows), CHUNK):
            self._call("POST", "collection_run_skipped", body=rows[start : start + CHUNK])

    def add_staged_reviews(self, run_product_id: str, reviews: list[dict[str, Any]]) -> None:
        rows = [staged_row(self.workspace_id, run_product_id, r) for r in reviews]
        for start in range(0, len(rows), CHUNK):
            self._call("POST", "collection_staged_reviews", body=rows[start : start + CHUNK])


def write_result(db: Db, run_id: str, result: dict[str, Any]) -> dict[str, Any]:
    """collect() 결과를 DB에 쓰고 수집 요청을 마무리한다.

    미리보기(ready)가 되는 경우: 읽은 제품이 하나라도 있다. 막혀서 중간에 멈췄어도 그때까지의 결과는 남기고 error에 이유를 적는다.
    제품을 하나도 못 읽었으면 failed.
    """
    done = 0
    staged = 0
    for p in result["products"]:
        run_product_id = db.add_run_product(run_id, p)
        reviews = [r for r in result["reviews"] if r["product_gd_no"] == p["gd_no"]]
        if reviews:
            db.add_staged_reviews(run_product_id, reviews)
        if p.get("status") == "done":
            done += 1
        staged += len(reviews)
    excluded = result.get("excluded", [])
    if excluded:
        db.add_skipped(run_id, excluded)
    aborted = result["meta"].get("aborted")
    status = "ready" if done else "failed"
    db.update_run(run_id, status=status, finished_at=now_iso(), error=aborted)
    return {
        "status": status, "products": len(result["products"]), "products_done": done,
        "staged_reviews": staged, "excluded": len(excluded), "aborted": aborted,
    }
