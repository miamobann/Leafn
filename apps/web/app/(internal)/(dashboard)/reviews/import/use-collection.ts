"use client";

// 수집 화면의 상태와 서버 호출: 조건, 수집 요청(불러오기), 진행 상황 확인, 저장, 닫기.
// 웹과 수집기는 DB로만 만난다: [불러오기]가 대기(queued) 요청을 만들면, 켜 둔 수집기(일꾼)가 집어 가서 읽고 미리보기(ready)로 바꾼다.
import { useCallback, useEffect, useRef, useState } from "react";
import type { CollectionView, CollectProject } from "@/lib/data/collection";
import { discardCollection, pollCollection, restoreCollection, saveCollection, startCollection, wakeCollector } from "@/lib/data/collection-actions";
import { type CollectForm, DEFAULT_STARS, needsSave } from "./collect-options";

const POLL_MS = 3000; // 진행 상황을 확인하는 간격

export function useCollection(project: CollectProject) {
  // 제품 종류는 우리 제품의 카테고리에서 시작한다
  const [form, setFormState] = useState<CollectForm>({
    platformId: "qoo10",
    categoryId: project.category.includes("美容液") ? "serum" : "toner",
    topN: 10,
    stars: DEFAULT_STARS,
    limit: 20,
  });
  const [view, setView] = useState<CollectionView | null>(null);
  const [restoring, setRestoring] = useState(true);
  // 화면을 열 때 지난 요청이 되살아났는가 (방금 만든 요청과 구분해서 "이전 요청이 남아 있어요"를 알려 준다)
  const [restored, setRestored] = useState(false);
  const [busy, setBusy] = useState<"start" | "save" | "reset" | "wake" | null>(null);
  const [wakeNote, setWakeNote] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());
  const polling = useRef(false);
  const lastStatus = useRef<string | null>(null);

  const setForm = useCallback((patch: Partial<CollectForm>) => setFormState((prev) => ({ ...prev, ...patch })), []);

  // 서버가 준 새 상태를 받아들인다. 미리보기가 처음 생기면 저장할 필요가 있는 제품을 미리 골라 두고, 요청의 조건을 선택 칸에 맞춘다
  const adopt = useCallback((next: CollectionView) => {
    if (next.run.status === "ready" && lastStatus.current !== "ready") {
      setSelected(new Set(next.rows.filter(needsSave).map((r) => r.id)));
    }
    lastStatus.current = next.run.status;
    setFormState({
      platformId: next.run.platformId as CollectForm["platformId"],
      categoryId: next.run.category as CollectForm["categoryId"],
      topN: next.run.topN,
      stars: next.run.stars,
      limit: next.run.reviewLimit,
    });
    setView(next);
  }, []);

  // 화면을 열 때: 이 우리 제품의 가장 최근 미리보기가 있으면 되살린다
  useEffect(() => {
    let off = false;
    restoreCollection(project.id)
      .then((res) => {
        if (off) return;
        if (res.ok && res.data) {
          adopt(res.data);
          setRestored(true);
        } else if (!res.ok) setMessage(res.message);
      })
      .catch(() => !off && setMessage("저장된 요청을 불러오지 못했어요. 새로고침해 주세요."))
      .finally(() => !off && setRestoring(false));
    return () => {
      off = true;
    };
  }, [project.id, adopt]);

  // 수집 중이면 몇 초마다 진행 상황을 확인한다 (수집기가 ready로 바꾸면 미리보기가 나타난다)
  const runId = view?.run.id ?? null;
  const status = view?.run.status ?? null;
  const waiting = status === "queued" || status === "running";
  useEffect(() => {
    if (!runId || !waiting) return;
    const timer = setInterval(async () => {
      setNow(Date.now());
      if (polling.current) return;
      polling.current = true;
      try {
        const res = await pollCollection(runId);
        if (res.ok) adopt(res.data);
        else {
          setMessage(res.message);
          setView(null);
        }
      } catch {
        // 네트워크가 잠깐 끊긴 경우: 다음 확인 때 다시 시도한다
      } finally {
        polling.current = false;
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [runId, waiting, adopt]);

  async function find() {
    setBusy("start");
    setMessage(null);
    setRestored(false);
    try {
      const res = await startCollection({ ownProductId: project.id, platformId: form.platformId, category: form.categoryId, topN: form.topN, stars: form.stars, reviewLimit: form.limit });
      if (res.ok) {
        adopt(res.data);
        void wake(res.data.run.id);
      } else setMessage(res.message);
    } catch {
      setMessage("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  /** 대기 중인 요청을 수집기가 집어 가도록 GitHub Actions를 실행시킨다. 요청 직후와 「수집기 다시 깨우기」가 부른다 */
  async function wake(runId = view?.run.id) {
    if (!runId) return;
    setWakeNote(null);
    try {
      const res = await wakeCollector(runId);
      setWakeNote(res.ok ? res.data.notice : res.message);
    } catch {
      setWakeNote("수집기를 깨우지 못했어요. 잠시 뒤 다시 눌러 주세요.");
    }
  }

  /** onSaved: 새 리뷰가 저장됐을 때만 부른다 (저장 직후 AI 처리를 시작하는 데 쓴다) */
  async function save(onSaved?: () => void) {
    if (!view || selected.size === 0) return;
    setBusy("save");
    setMessage(null);
    try {
      const res = await saveCollection(view.run.id, Array.from(selected));
      if (res.ok) {
        setSelected(new Set());
        adopt(res.data);
        if ((res.data.run.savedCount ?? 0) > 0) onSaved?.();
      } else setMessage(res.message);
    } catch {
      setMessage("서버에 연결하지 못했어요. 저장됐는지 새로고침해서 확인해 주세요.");
    } finally {
      setBusy(null);
    }
  }

  /** 미리보기를 닫는다. 저장 전이면 요청을 지우고(임시 리뷰도 함께), 저장이 끝난 요청은 화면만 비운다 */
  async function reset(): Promise<boolean> {
    if (!view) return false;
    setBusy("reset");
    setMessage(null);
    try {
      if (view.run.status !== "saved") {
        const res = await discardCollection(view.run.id);
        if (!res.ok) {
          setMessage(res.message);
          return false;
        }
      }
      lastStatus.current = null;
      setRestored(false);
      setWakeNote(null);
      setView(null);
      setSelected(new Set());
      return true;
    } catch {
      setMessage("서버에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  /** 저장이 끝난 뒤 같은 조건으로 다시 찾는다 (이미 저장한 리뷰는 건너뛰고 그다음 최신 리뷰를 가져온다) */
  async function again() {
    if (await reset()) await find();
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  }

  return { form, setForm, view, status, waiting, restoring, busy, message, wakeNote, restored, selected, setSelected, toggle, now, find, save, reset, again, wake };
}
