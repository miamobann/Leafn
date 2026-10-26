"""Qoo10 경쟁 제품 리뷰를 수집해 Supabase의 수집 요청(collection_runs)에 미리보기로 쓴다.

두 가지 방법이 있다 (실행은 저장소 루트에서)
  1) 한 번만 실행: 요청을 직접 만들고 바로 수집한다
       python -m collectors.collect_to_db --own-product "Leaf& Dew Deep Skin" --category toner --top-n 10 --stars 3 --limit 20
  2) 일꾼(worker): 화면의 [경쟁 제품 불러오기]가 만든 대기(queued) 요청을 집어 가서 수집한다. 켜 두는 동안 계속 기다린다
       python -m collectors.collect_to_db --worker          (--once: 대기 요청을 처리하고 바로 끝낸다)

웹과 수집기는 DB로만 만난다: 화면이 queued 요청을 만들고 → 일꾼이 running으로 바꿔 수집하고 → ready(미리보기)로 끝낸다.
정식 저장(reviews)은 화면의 [저장]이 한다 (save_collection_run). 요청 간격·막힘 처리는 sources/qoo10.py 규칙 그대로다.
"""

from __future__ import annotations

import argparse
import sys
import time
from datetime import datetime, timedelta, timezone
from typing import Any, Callable

from collectors.db import Db, DbError, load_settings, now_iso, write_result
from collectors.sources import qoo10

PLATFORM_ID = "qoo10"
POLL_SECONDS = 5.0
STALE_AFTER = timedelta(minutes=20)  # 수집 중으로 이만큼 지나도 끝나지 않으면 일꾼이 꺼진 것으로 본다


def log(message: str) -> None:
    print(message, file=sys.stderr)


def progress_reporter(db: Db, run_id: str, say: Callable[[str], None]) -> Callable[[int, int, str], None]:
    """제품 하나를 마칠 때마다 진행(몇 개 중 몇 개)을 요청 행에 적는다. 적지 못해도 수집은 계속한다 (칸이 없는 옛 DB 등)."""
    broken = False

    def report(done: int, total: int, title: str) -> None:
        nonlocal broken
        if broken:
            return
        try:
            db.update_run(run_id, progress_done=done, progress_total=total, progress_note=title[:80] or None)
        except DbError as err:
            broken = True
            say(f"! 진행 표시를 쓰지 못해 건너뛰어요: {err}")

    return report


def process_run(db: Db, run: dict[str, Any], say: Callable[[str], None] = log) -> int:
    """수집 중(running)이 된 요청 한 건을 처리한다. 미리보기까지 잘 끝나면 0, 막히거나 실패하면 1.

    어떤 오류든 요청을 실패로 남기고 돌아온다 (일꾼이 한 요청 때문에 멈추지 않게).
    """
    run_id = run["id"]
    try:
        if run["platform_id"] != PLATFORM_ID:
            raise ValueError(f"아직 {PLATFORM_ID}만 수집할 수 있어요 (요청: {run['platform_id']})")
        if run["category"] not in qoo10.CATEGORIES:
            raise ValueError(f"아직 지원하지 않는 제품 종류예요: {run['category']} (지원: {', '.join(qoo10.CATEGORIES)})")
        known_ids, saved_products = db.history(run["platform_id"])
        say(f"이미 저장한 리뷰 {len(known_ids)}건 · 저장한 적 있는 제품 {len(saved_products)}개")
        result = qoo10.collect(
            run["category"], run["top_n"], run["stars"], run["review_limit"], known_ids, saved_products, log=say,
            on_progress=progress_reporter(db, run_id, say),
        )
        summary = write_result(db, run_id, result)
    except Exception as err:
        db.update_run(run_id, status="failed", finished_at=now_iso(), error=str(err)[:300])
        say(f"! 수집 요청 {run_id} 실패: {err}")
        return 1
    say(f"수집 요청 {run_id}: {summary}")
    return 0 if summary["status"] == "ready" and not summary["aborted"] else 1


def work(
    db: Db,
    once: bool = False,
    interval: float = POLL_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
    say: Callable[[str], None] = log,
) -> None:
    """대기 요청을 하나씩 집어 처리한다. once면 더 없을 때 끝내고, 아니면 계속 기다린다."""
    stale = db.fail_stale_runs((datetime.now(timezone.utc) - STALE_AFTER).isoformat(timespec="seconds"))
    if stale:
        say(f"오래 멈춰 있던 수집 요청 {stale}건을 실패로 바꿨어요")
    say("대기 중인 요청을 확인해요" + ("" if once else " (끝내려면 Ctrl+C)"))
    while True:
        run = db.next_queued_run()
        if run and db.claim_run(run["id"]):
            say(f"요청 {run['id']} 시작: {run['category']} 상위 {run['top_n']}개 · {','.join(str(x) for x in run['stars'])}점 · 별점마다 새로 {run['review_limit']}건")
            process_run(db, run, say)
            continue  # 쉬지 않고 다음 요청을 확인한다
        if once:
            return
        sleep(interval)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Qoo10 경쟁 제품 리뷰를 수집해 DB에 미리보기로 쓴다 (소량, 로컬 실행)")
    parser.add_argument("--worker", action="store_true", help="화면이 만든 대기 요청을 집어 가서 수집한다")
    parser.add_argument("--once", action="store_true", help="--worker와 함께: 대기 요청을 처리하고 바로 끝낸다")
    parser.add_argument("--own-product", help="(한 번만 실행) 어느 자사 제품의 경쟁 제품을 모으는지 (products.name 그대로)")
    parser.add_argument("--category", choices=sorted(qoo10.CATEGORIES), default="toner")
    parser.add_argument("--top-n", type=int, default=10, help="리뷰 많은 순 상위 N개 제품 (세트 상품 제외)")
    parser.add_argument("--stars", default="3", help="가져올 별점. 쉼표로 여러 개 (예: 3 또는 1,2,3)")
    parser.add_argument("--limit", type=int, default=20, help="별점마다 새로 가져올 리뷰 수")
    args = parser.parse_args(argv)
    if not args.worker and not args.own_product:
        parser.error("--own-product(한 번만 실행) 또는 --worker(대기 요청 처리) 중 하나가 필요해요")
    stars = qoo10.parse_stars(args.stars)
    if stars is None or not (1 <= args.top_n <= 50 and 1 <= args.limit <= 200):
        parser.error("범위: top-n 1~50, stars는 1~5 (예: 3 또는 1,2,3), limit 1~200")

    try:
        db = Db(load_settings())
        log(f"쓰는 곳: {db.host}")  # 어느 프로젝트에 쓰는지 눈으로 확인하게 한다
        if args.worker:
            try:
                work(db, once=args.once)
            except KeyboardInterrupt:
                log("끝냈어요")
            return 0
        own = db.find_own_product(args.own_product)
        removed = db.delete_open_runs(own["id"])
        if removed:
            log(f"저장하지 않은 이전 수집 요청 {removed}건을 지웠어요")
        run_id = db.create_run(PLATFORM_ID, args.category, own["id"], args.top_n, stars, args.limit)
    except DbError as err:
        print(f"! {err}", file=sys.stderr)
        return 2

    run = {"id": run_id, "platform_id": PLATFORM_ID, "category": args.category, "top_n": args.top_n, "stars": stars, "review_limit": args.limit}
    return process_run(db, run)


if __name__ == "__main__":
    raise SystemExit(main())
