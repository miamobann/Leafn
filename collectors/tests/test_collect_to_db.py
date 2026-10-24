"""일꾼(worker)과 요청 처리 테스트. 네트워크를 쓰지 않는다 (가짜 세션 + collect()를 가짜로 바꾼다).

실행 (저장소 루트에서): python -m unittest discover -s collectors/tests -t .
"""

import unittest
from unittest import mock

from collectors import collect_to_db as c
from collectors import db as d
from collectors.tests.test_db import FakeResponse, make_db, product, review

RUN = {"id": "run-1", "platform_id": "qoo10", "category": "toner", "top_n": 2, "stars": [3], "review_limit": 20}


def fake_result(aborted=None):
    return {"meta": {"aborted": aborted} if aborted else {}, "products": [product()], "reviews": [review()]}


class DbWorkerCallsTest(unittest.TestCase):
    def test_next_queued_run_asks_for_the_oldest_queued_one(self):
        db, session = make_db([FakeResponse([{"id": "r1"}])])
        self.assertEqual(db.next_queued_run(), {"id": "r1"})
        params = session.calls[0]["params"]
        self.assertEqual((params["status"], params["order"], params["workspace_id"]), ("eq.queued", "created_at.asc", "eq.ws-1"))

    def test_no_queued_run_gives_none(self):
        db, _ = make_db([FakeResponse([])])
        self.assertIsNone(db.next_queued_run())

    def test_claim_only_succeeds_while_still_queued(self):
        db, session = make_db([FakeResponse([{"id": "r1"}]), FakeResponse([])])
        self.assertTrue(db.claim_run("r1"))
        self.assertFalse(db.claim_run("r1"))  # 다른 일꾼이 먼저 집어 갔다
        self.assertEqual(session.calls[0]["params"]["status"], "eq.queued")  # 조건이 겹침을 막는다
        self.assertEqual(session.calls[0]["body"]["status"], "running")

    def test_stale_runs_are_failed_with_a_reason(self):
        db, session = make_db([FakeResponse([{"id": "a"}, {"id": "b"}])])
        self.assertEqual(db.fail_stale_runs("2026-10-24T00:00:00+00:00"), 2)
        call = session.calls[0]
        self.assertEqual((call["params"]["status"], call["params"]["started_at"]), ("eq.running", "lt.2026-10-24T00:00:00+00:00"))
        self.assertEqual(call["body"]["status"], "failed")


class ProcessRunTest(unittest.TestCase):
    def test_success_writes_the_preview_and_returns_zero(self):
        # history 2번(리뷰, 제품) → 제품 쓰기 → 임시 리뷰 → 요청 마무리
        db, session = make_db([
            FakeResponse([]), FakeResponse([]),
            FakeResponse([{"id": "rp-1"}]), FakeResponse(None), FakeResponse(None),
        ])
        with mock.patch.object(c.qoo10, "collect", return_value=fake_result()):
            self.assertEqual(c.process_run(db, RUN, say=lambda _m: None), 0)
        self.assertEqual(session.calls[-1]["body"]["status"], "ready")

    def test_unsupported_platform_marks_the_run_failed_without_collecting(self):
        db, session = make_db([FakeResponse(None)])
        with mock.patch.object(c.qoo10, "collect") as collect:
            self.assertEqual(c.process_run(db, {**RUN, "platform_id": "rakuten"}, say=lambda _m: None), 1)
        collect.assert_not_called()
        body = session.calls[-1]["body"]
        self.assertEqual(body["status"], "failed")
        self.assertIn("rakuten", body["error"])

    def test_unsupported_category_is_explained(self):
        db, session = make_db([FakeResponse(None)])
        self.assertEqual(c.process_run(db, {**RUN, "category": "cream"}, say=lambda _m: None), 1)
        self.assertIn("cream", session.calls[-1]["body"]["error"])

    def test_unexpected_error_fails_the_run_instead_of_stopping_the_worker(self):
        db, session = make_db([FakeResponse([]), FakeResponse([]), FakeResponse(None)])
        with mock.patch.object(c.qoo10, "collect", side_effect=RuntimeError("boom")):
            self.assertEqual(c.process_run(db, RUN, say=lambda _m: None), 1)
        self.assertEqual((session.calls[-1]["body"]["status"], session.calls[-1]["body"]["error"]), ("failed", "boom"))

    def test_blocked_midway_returns_one_but_keeps_the_preview(self):
        db, session = make_db([
            FakeResponse([]), FakeResponse([]),
            FakeResponse([{"id": "rp-1"}]), FakeResponse(None), FakeResponse(None),
        ])
        with mock.patch.object(c.qoo10, "collect", return_value=fake_result(aborted="접근이 막혀 멈췄어요")):
            self.assertEqual(c.process_run(db, RUN, say=lambda _m: None), 1)
        self.assertEqual(session.calls[-1]["body"]["status"], "ready")


class WorkTest(unittest.TestCase):
    def test_once_with_nothing_queued_returns_without_sleeping(self):
        db, _ = make_db([FakeResponse([]), FakeResponse([])])  # 멈춘 요청 정리, 대기 요청 조회
        slept: list[float] = []
        c.work(db, once=True, sleep=slept.append, say=lambda _m: None)
        self.assertEqual(slept, [])

    def test_runs_a_claimed_request_then_checks_again(self):
        db, _ = make_db([FakeResponse([]), FakeResponse([RUN]), FakeResponse([{"id": "run-1"}]), FakeResponse([])])
        with mock.patch.object(c, "process_run", return_value=0) as process:
            c.work(db, once=True, sleep=lambda _s: None, say=lambda _m: None)
        process.assert_called_once()

    def test_skips_a_request_another_worker_already_took(self):
        db, _ = make_db([FakeResponse([]), FakeResponse([RUN]), FakeResponse([]), FakeResponse([])])
        with mock.patch.object(c, "process_run") as process:
            c.work(db, once=True, sleep=lambda _s: None, say=lambda _m: None)
        process.assert_not_called()

    def test_waits_between_checks_when_not_once(self):
        db, _ = make_db([FakeResponse([]), FakeResponse([]), FakeResponse([])])
        slept: list[float] = []

        def stop(seconds: float) -> None:
            slept.append(seconds)
            if len(slept) == 2:
                raise KeyboardInterrupt

        with self.assertRaises(KeyboardInterrupt):
            c.work(db, once=False, interval=5.0, sleep=stop, say=lambda _m: None)
        self.assertEqual(slept, [5.0, 5.0])


if __name__ == "__main__":
    unittest.main()
