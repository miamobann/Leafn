"""수집기 DB 층 테스트. 네트워크를 쓰지 않는다 (가짜 세션이 요청을 기록하고 미리 정한 응답을 돌려준다).

실행 (저장소 루트에서): python -m unittest discover -s collectors/tests -t .
"""

import json
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from collectors import db as d

SETTINGS = {"SUPABASE_URL": "https://example.supabase.co", "SUPABASE_SERVICE_ROLE_KEY": "secret-key", "WORKSPACE_ID": "ws-1"}


class FakeResponse:
    def __init__(self, body=None, status: int = 200):
        self.status_code = status
        self.text = "" if body is None else (body if isinstance(body, str) else json.dumps(body))

    def json(self):
        return json.loads(self.text)


class FakeSession:
    """session.request를 대신한다. 부른 내용을 calls에 쌓고, 정해 둔 응답을 차례로 돌려준다."""

    def __init__(self, replies=None):
        self.headers: dict[str, str] = {}
        self.replies = list(replies or [])
        self.calls: list[dict] = []

    def request(self, method, url, params=None, data=None, headers=None, timeout=None):
        self.calls.append({"method": method, "url": url, "params": params or {}, "body": json.loads(data) if data else None, "headers": headers or {}})
        return self.replies.pop(0) if self.replies else FakeResponse([])


def make_db(replies=None):
    session = FakeSession(replies)
    return d.Db(SETTINGS, session=session), session


def product(**over):
    base = {
        "rank": 1, "gd_no": "111", "title": "化粧水", "brand": "ブランド", "url": "https://x/111", "is_set": False,
        "listing_type": "goods", "status": "done", "read": 30, "skipped_known": 2, "stop": "limit",
        "site_total_count": 500, "site_low_count": 30, "low_count_exact": False,
        "stars": {"3": {"start_page": 56, "read": 30, "skipped_known": 10, "new": 20, "exhausted": False}},
    }
    return {**base, **over}


def review(**over):
    base = {
        "product_gd_no": "111", "lang": "ja", "external_id": "r1", "rating": 1, "body": "本文",
        "posted_at": "2026-06-12", "raw": {"options": {"肌タイプ": "乾燥肌"}, "likes": 3},
    }
    return {**base, **over}


class SettingsTest(unittest.TestCase):
    def _file(self, text: str) -> Path:
        tmp = Path(tempfile.mkdtemp()) / ".env.local"
        tmp.write_text(text, encoding="utf-8-sig")  # BOM이 있어도 읽혀야 한다
        return tmp

    def test_reads_file_and_ignores_comments(self):
        path = self._file("# 설명\nSUPABASE_URL=https://a.supabase.co/\nSUPABASE_SERVICE_ROLE_KEY=\"k\"\nWORKSPACE_ID=w\n")
        got = d.load_settings(path, environ={})
        self.assertEqual((got["SUPABASE_URL"], got["SUPABASE_SERVICE_ROLE_KEY"], got["WORKSPACE_ID"]), ("https://a.supabase.co", "k", "w"))

    def test_environment_variable_wins_over_file(self):
        path = self._file("SUPABASE_URL=https://a\nSUPABASE_SERVICE_ROLE_KEY=k\nWORKSPACE_ID=file\n")
        self.assertEqual(d.load_settings(path, environ={"WORKSPACE_ID": "env"})["WORKSPACE_ID"], "env")

    def test_missing_setting_names_what_is_missing_without_values(self):
        path = self._file("SUPABASE_URL=https://a\nSUPABASE_SERVICE_ROLE_KEY=topsecret\n")
        with self.assertRaises(d.DbError) as ctx:
            d.load_settings(path, environ={})
        self.assertIn("WORKSPACE_ID", str(ctx.exception))
        self.assertNotIn("topsecret", str(ctx.exception))


class RowMappingTest(unittest.TestCase):
    def test_product_row_carries_site_numbers_and_workspace(self):
        row = d.product_row("run-1", "ws-1", product())
        self.assertEqual((row["workspace_id"], row["run_id"], row["external_id"]), ("ws-1", "run-1", "111"))
        self.assertEqual((row["site_total_count"], row["site_low_count"], row["site_low_count_exact"]), (500, 30, False))
        self.assertEqual((row["status"], row["stop_reason"], row["read_count"], row["skipped_known"]), ("done", "limit", 30, 2))
        self.assertEqual(row["star_counts"]["3"]["start_page"], 56)  # 별점별 결과는 jsonb로 그대로 둔다

    def test_failed_product_keeps_error_and_has_no_numbers(self):
        row = d.product_row("run-1", "ws-1", product(status="failed", error="boom", site_total_count=None, site_low_count=None, low_count_exact=None, stop=None))
        self.assertEqual((row["status"], row["error"], row["site_low_count"], row["stop_reason"]), ("failed", "boom", None, None))

    def test_staged_row_uses_japan_midnight_and_skin_type(self):
        row = d.staged_row("ws-1", "rp-1", review())
        self.assertEqual(row["posted_at"], "2026-06-12T00:00:00+09:00")
        self.assertEqual(row["reviewer_attrs"], {"skin_type": "乾燥肌"})
        self.assertEqual((row["workspace_id"], row["run_product_id"], row["rating_scale"], row["lang"]), ("ws-1", "rp-1", 5, "ja"))
        self.assertNotIn("excluded_reason", row)  # 제외 표시는 AI 분류 단계에서 채운다. 지금은 비워 둬 null(분석 대상)이다

    def test_staged_row_leaves_missing_values_empty(self):
        row = d.staged_row("ws-1", "rp-1", review(posted_at=None, raw={"options": {}}))
        self.assertIsNone(row["posted_at"])
        self.assertIsNone(row["reviewer_attrs"])


class SkippedRowTest(unittest.TestCase):
    ITEM = {"rank": 7, "gd_no": "777", "title": "シリーズ 化粧水/クリーム", "brand": "ブランド", "url": "https://x/777", "reason": "multi_type"}

    def test_maps_to_the_skipped_table_columns_with_workspace(self):
        row = d.skipped_row("run-1", "ws-1", self.ITEM)
        self.assertEqual((row["workspace_id"], row["run_id"], row["rank"], row["external_id"], row["reason"]), ("ws-1", "run-1", 7, "777", "multi_type"))

    def test_empty_brand_and_url_are_stored_as_empty_and_null(self):
        row = d.skipped_row("run-1", "ws-1", {**self.ITEM, "brand": None, "url": ""})
        self.assertEqual((row["brand"], row["url"]), ("", None))

    def test_skipped_items_are_sent_in_chunks(self):
        with mock.patch.object(d, "CHUNK", 2):
            db, session = make_db()
            db.add_skipped("run-1", [{**self.ITEM, "gd_no": str(i), "rank": i + 1} for i in range(3)])
        self.assertEqual([(c["url"].rsplit("/", 1)[1], len(c["body"])) for c in session.calls], [("collection_run_skipped", 2), ("collection_run_skipped", 1)])


class DbCallsTest(unittest.TestCase):
    def test_sends_service_key_headers_and_workspace_filter(self):
        db, session = make_db([FakeResponse([{"id": "o1", "name": "N"}])])
        db.find_own_product("Leaf& Dew Deep Skin")
        call = session.calls[0]
        self.assertEqual(session.headers["apikey"], "secret-key")
        self.assertEqual(call["params"]["workspace_id"], "eq.ws-1")
        self.assertEqual(call["params"]["name"], "eq.Leaf& Dew Deep Skin")  # & 같은 글자도 requests가 알아서 인코딩한다

    def test_missing_own_product_lists_the_available_ones(self):
        db, _ = make_db([FakeResponse([]), FakeResponse([{"name": "A"}, {"name": "B"}])])
        with self.assertRaises(d.DbError) as ctx:
            db.find_own_product("없는 제품")
        self.assertIn("A", str(ctx.exception))

    def test_history_reads_every_page(self):
        with mock.patch.object(d, "PAGE", 2):
            db, session = make_db([
                FakeResponse([{"external_id": "a"}, {"external_id": "b"}]),  # 가득 찬 페이지 → 다음 페이지를 읽는다
                FakeResponse([{"external_id": "c"}]),
                FakeResponse([{"external_id": "111"}]),  # 제품
            ])
            known, saved = db.history("qoo10")
        self.assertEqual(known, {"a", "b", "c"})
        self.assertEqual(saved, {"111"})
        self.assertEqual([c["params"].get("offset") for c in session.calls[:2]], ["0", "2"])

    def test_create_run_sends_checked_stars_and_keeps_max_star_for_compatibility(self):
        db, session = make_db([FakeResponse([{"id": "run-9"}])])
        self.assertEqual(db.create_run("qoo10", "toner", "own-1", 10, [2, 3], 20), "run-9")
        body = session.calls[0]["body"]
        self.assertEqual((body["stars"], body["max_star"], body["review_limit"], body["status"]), ([2, 3], 3, 20, "running"))

    def test_delete_open_runs_only_touches_unsaved_runs_of_that_product(self):
        db, session = make_db([FakeResponse([{"id": "x"}, {"id": "y"}])])
        self.assertEqual(db.delete_open_runs("own-1"), 2)
        call = session.calls[0]
        self.assertEqual(call["method"], "DELETE")
        self.assertEqual(call["params"]["status"], "in.(queued,running,ready)")  # saved · failed 기록은 건드리지 않는다
        self.assertEqual((call["params"]["workspace_id"], call["params"]["own_product_id"]), ("eq.ws-1", "eq.own-1"))

    def test_staged_reviews_are_sent_in_chunks(self):
        with mock.patch.object(d, "CHUNK", 2):
            db, session = make_db()
            db.add_staged_reviews("rp-1", [review(external_id=str(i)) for i in range(5)])
        self.assertEqual([len(c["body"]) for c in session.calls], [2, 2, 1])

    def test_http_error_is_raised_without_the_key(self):
        db, _ = make_db([FakeResponse("duplicate key", status=409)])
        with self.assertRaises(d.DbError) as ctx:
            db.update_run("run-1", status="ready")
        self.assertIn("409", str(ctx.exception))
        self.assertNotIn("secret-key", str(ctx.exception))


class WriteResultTest(unittest.TestCase):
    def _result(self, products, reviews, aborted=None):
        meta = {"aborted": aborted} if aborted else {}
        return {"meta": meta, "products": products, "reviews": reviews}

    def test_writes_products_and_staged_reviews_then_marks_ready(self):
        db, session = make_db([
            FakeResponse([{"id": "rp-1"}]),  # 제품 1
            FakeResponse(None),  # 제품 1의 임시 리뷰
            FakeResponse([{"id": "rp-2"}]),  # 제품 2 (리뷰 없음)
            FakeResponse(None),  # 수집 요청 갱신
        ])
        result = self._result([product(), product(gd_no="222", rank=2)], [review(), review(external_id="r2")])
        summary = d.write_result(db, "run-1", result)
        self.assertEqual((summary["status"], summary["products_done"], summary["staged_reviews"]), ("ready", 2, 2))
        staged_call = session.calls[1]
        self.assertEqual((staged_call["url"].rsplit("/", 1)[1], len(staged_call["body"])), ("collection_staged_reviews", 2))
        self.assertEqual(staged_call["body"][0]["run_product_id"], "rp-1")
        self.assertEqual(len(session.calls), 4)  # 리뷰 없는 제품은 임시 리뷰 요청을 보내지 않는다
        self.assertEqual(session.calls[-1]["body"]["status"], "ready")

    def test_excluded_listings_are_written_and_counted(self):
        db, session = make_db([FakeResponse([{"id": "rp-1"}]), FakeResponse(None), FakeResponse(None), FakeResponse(None)])
        result = {**self._result([product()], [review()]), "excluded": [{"rank": 2, "gd_no": "222", "title": "洗顔クレンジング", "brand": "", "url": "", "reason": "not_toner"}]}
        summary = d.write_result(db, "run-1", result)
        self.assertEqual(summary["excluded"], 1)
        skipped_call = next(c for c in session.calls if c["url"].endswith("collection_run_skipped"))
        self.assertEqual(skipped_call["body"][0]["reason"], "not_toner")

    def test_no_excluded_listings_sends_no_skipped_request(self):
        db, session = make_db([FakeResponse([{"id": "rp-1"}]), FakeResponse(None), FakeResponse(None)])
        d.write_result(db, "run-1", self._result([product()], [review()]))
        self.assertFalse(any(c["url"].endswith("collection_run_skipped") for c in session.calls))

    def test_nothing_read_marks_the_run_failed(self):
        db, session = make_db([FakeResponse([{"id": "rp-1"}]), FakeResponse(None)])
        result = self._result([product(status="failed", error="boom")], [])
        self.assertEqual(d.write_result(db, "run-1", result)["status"], "failed")

    def test_blocked_midway_keeps_partial_result_and_records_why(self):
        db, session = make_db([FakeResponse([{"id": "rp-1"}]), FakeResponse(None), FakeResponse(None)])
        result = self._result([product()], [review()], aborted="접근이 막혀 멈췄어요")
        summary = d.write_result(db, "run-1", result)
        self.assertEqual(summary["status"], "ready")  # 읽은 제품이 있으니 미리보기는 남긴다
        self.assertEqual(session.calls[-1]["body"]["error"], "접근이 막혀 멈췄어요")


if __name__ == "__main__":
    unittest.main()
