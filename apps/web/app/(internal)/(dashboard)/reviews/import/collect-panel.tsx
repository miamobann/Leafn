"use client";

// 경쟁 제품 리뷰 자동 수집 화면: ① 찾을 조건을 정하고 → ② 찾은 경쟁 제품 중 저장할 제품에 체크하고 → ③ 리뷰를 저장한다.
// 용어: "찾기" = 수집 요청을 만들고 수집기가 읽어 온 목록을 미리보기로 받는 것 (아직 저장되지 않는다). "저장" = 미리보기를 DB(reviews)에 확정하는 것.
// 상태와 서버 호출은 use-collection.ts, 조건 칸은 collect-conditions.tsx, 결과 표는 collect-table.tsx에 있다.
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import type { CollectProject } from "@/lib/data/collection";
import { cn } from "@/lib/utils";
import { Conditions } from "./collect-conditions";
import { conditionText, METHOD, n, needsSave, STEPS, TEXT } from "./collect-options";
import { ResultTable } from "./collect-table";
import {
  ActionBar,
  BigStepper,
  bigButtonClass,
  bigSelectClass,
  MakingReport,
  moveLinkClass,
  NextSteps,
  SavedPanel,
  SelectField,
  Spinner,
  SummaryBar,
} from "./import-parts";
import { IMPORT_PLATFORMS } from "./import-platforms";
import { useCollection } from "./use-collection";

function CollectPanel({ project, picker }: { project: CollectProject; picker: ReactNode }) {
  const c = useCollection(project);
  const { form, view, status, busy, selected } = c;

  const rows = view && (view.run.status === "ready" || view.run.status === "saved") ? view.rows : null;
  const saved = status === "saved";
  const stage: 1 | 2 | 3 = !view || status === "failed" ? 1 : saved ? 3 : 2;
  const locked = busy !== null || c.restoring || view !== null; // 요청이 있는 동안은 조건을 바꾸지 않는다 (바꾸려면 "조건 바꾸기")
  const platform = IMPORT_PLATFORMS.find((p) => p.id === form.platformId);
  const platformLabel = platform?.label ?? "플랫폼";
  const starLabel = `${form.stars.toSorted((a, b) => a - b).join("·")}점`;
  const chosen = rows?.filter((r) => selected.has(r.id)) ?? [];
  const upTo = chosen.reduce((sum, r) => sum + r.newCount, 0); // 이번에 새로 저장될 리뷰 수 (이미 저장된 것은 이미 뺀 값이다)
  const savedRows = rows?.filter((r) => (r.savedNow ?? 0) > 0) ?? [];
  const savedTotal = view?.run.savedCount ?? savedRows.reduce((sum, r) => sum + (r.savedNow ?? 0), 0);

  const condBar = (action: ReactNode) => (
    <SummaryBar action={action}>
      <span className="text-[13px] text-muted-foreground">찾은 조건</span>
      <b className="font-medium">
        {project.brand} {project.name}과 비교
      </b>
      <span className="text-muted-foreground">· {conditionText(form, platformLabel)}</span>
    </SummaryBar>
  );
  const errorBox = c.message && <p className="rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-3 text-sm">{c.message}</p>;

  return (
    <div className="space-y-6">
      <BigStepper steps={STEPS} current={stage} />

      {c.restoring && <p className="text-sm text-muted-foreground">지난 요청을 확인하는 중…</p>}

      {!c.restoring && stage === 1 && (
        <>
          <Conditions picker={picker} form={form} locked={locked} onChange={c.setForm} />
          {view && status === "failed" && (
            <div className="space-y-1 rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-4 text-sm">
              <p className="font-medium">가져오지 못했어요</p>
              <p className="text-xs text-muted-foreground">{view.run.error ?? "수집기가 이유를 남기지 않았어요."}</p>
            </div>
          )}
          {errorBox}
          <ActionBar
            label="이렇게 찾아요"
            value={conditionText(form, platformLabel)}
            note={
              form.platformId !== "qoo10"
                ? "라쿠텐 가져오기는 기능 준비 중이에요. 지금은 Qoo10을 골라 주세요."
                : form.stars.length === 0
                  ? "가져올 별점을 하나 이상 골라 주세요."
                  : "아직 아무것도 저장되지 않아요"
            }
          >
            {view ? (
              <Button className={bigButtonClass} onClick={c.reset} disabled={busy !== null}>
                {busy === "reset" ? "정리하는 중…" : "조건 다시 정하기"}
              </Button>
            ) : (
              <Button className={bigButtonClass} onClick={c.find} disabled={locked || form.stars.length === 0 || form.platformId !== "qoo10"}>
                {busy === "start" ? "요청 보내는 중…" : "경쟁 제품 찾기"}
              </Button>
            )}
          </ActionBar>
          <details className="rounded-lg border px-3.5 py-2.5 text-[13px] text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">어떻게 가져오나요?</summary>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              <li>{platform ? METHOD[platform.id] : null}</li>
              <li>이미 저장한 리뷰는 건너뛰고, 아직 없는 리뷰만 별점마다 새로 가져와요.</li>
              <li>별점이 낮아도 배송·누락 같은 제품 외 불만일 수 있어요. 이 리뷰를 AI가 가려내는 기능은 아직 연결 전이에요.</li>
            </ul>
          </details>
        </>
      )}

      {view && c.waiting && (
        <>
          {condBar(
            <Button variant="outline" size="sm" onClick={c.reset} disabled={busy !== null || status === "running"} title={status === "running" ? "읽기 시작한 요청은 끝난 뒤에 정리할 수 있어요" : undefined}>
              {busy === "reset" ? "취소하는 중…" : "요청 취소"}
            </Button>,
          )}
          <section className="flex min-h-[420px] flex-col items-center justify-center gap-3.5 rounded-xl border p-10 text-center">
            <Spinner className="size-11" />
            <h2 className="text-xl font-semibold">{platformLabel}에서 경쟁 제품 리뷰를 읽고 있어요. 몇 분 정도 걸려요.</h2>
            <p className="text-sm text-muted-foreground">이 창을 닫아도 계속 진행돼요. 편하게 다른 작업 보다가 돌아와 주세요.</p>
          </section>
          {errorBox}
        </>
      )}

      {view && rows && !saved && (
        <>
          {condBar(
            <Button variant="outline" size="sm" onClick={c.reset} disabled={busy !== null}>
              {busy === "reset" ? "정리하는 중…" : "조건 바꾸기"}
            </Button>,
          )}
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">리뷰를 저장할 제품에 체크해 주세요</h2>
            <p className="text-sm text-muted-foreground">
              경쟁 제품 {rows.length}개를 찾았어요. 새 리뷰가 있는 {rows.filter(needsSave).length}개는 미리 체크해 두었어요.{" "}
              <span className="text-status-pending">확인 필요</span> 표시는 직접 보고 골라 주세요.
            </p>
          </div>
          <ResultTable
            rows={rows}
            selected={selected}
            platformLabel={platformLabel}
            starLabel={starLabel}
            saved={false}
            busy={busy !== null}
            onToggle={c.toggle}
            onToggleAll={() => c.setSelected(rows.length > 0 && selected.size === rows.length ? new Set() : new Set(rows.filter((r) => !r.failed).map((r) => r.id)))}
          />
          {errorBox}
          <ActionBar sticky label="체크한 제품" value={chosen.length > 0 ? `${chosen.length}개 제품 · 새 리뷰 ${n(upTo)}건` : "저장할 제품에 체크해 주세요"} note="이미 저장된 리뷰는 다시 저장하지 않아요">
            <Button className={bigButtonClass} onClick={c.save} disabled={busy !== null || chosen.length === 0}>
              {busy === "save" ? "저장하는 중…" : `${n(upTo)}건 저장하기`}
            </Button>
          </ActionBar>
        </>
      )}

      {view && rows && saved && (
        <>
          <SavedPanel title={`리뷰 ${n(savedTotal)}건을 저장했어요`} sub={`경쟁 제품 ${savedRows.length}개 · 지금 AI가 리뷰를 읽고 리포트를 만들고 있어요.`}>
            <MakingReport />
            <div className="border-t border-status-approved/40 pt-4">
              <NextSteps>
                <Link href="/reviews" className={cn(moveLinkClass, "text-[15px]")}>
                  경쟁 제품 리뷰 리포트 보기 →
                </Link>
                <Link href="/reviews/compare" className={cn(moveLinkClass, "text-[15px]")}>
                  소구점 찾기 →
                </Link>
                <Button variant="outline" size="sm" onClick={c.reset} disabled={busy !== null}>
                  다른 경쟁 제품 더 가져오기
                </Button>
              </NextSteps>
            </div>
          </SavedPanel>
          {condBar(
            <Button variant="outline" size="sm" onClick={c.again} disabled={busy !== null}>
              {busy ? "찾는 중…" : "같은 조건으로 다시 찾기"}
            </Button>,
          )}
          {errorBox}
          <div className="space-y-1">
            <h3 className="text-base font-semibold">저장 결과</h3>
            <p className="text-[13px] text-muted-foreground">체크하지 않은 제품은 저장하지 않았어요.</p>
          </div>
          <ResultTable rows={rows} selected={selected} platformLabel={platformLabel} starLabel={starLabel} saved busy={busy !== null} onToggle={c.toggle} onToggleAll={() => undefined} />
        </>
      )}
    </div>
  );
}

// 비교할 우리 제품은 아직 상단 프로젝트 선택기가 없어서 질문 1의 드롭다운으로 고른다.
// 상단 선택기(Min)가 생기면 이 드롭다운을 없애고, 선택된 제품 하나를 CollectPanel에 그대로 넘기면 된다.
export function PlatformCollect({ projects, initialProjectId }: { projects: CollectProject[]; initialProjectId?: string | null }) {
  const [projectId, setProjectId] = useState(() => (projects.some((p) => p.id === initialProjectId) ? (initialProjectId ?? "") : (projects[0]?.id ?? "")));
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  if (!project) return <p className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{TEXT.noProjects}</p>;

  // key가 바뀌면 지난 목록과 제품 종류 기본값이 함께 초기화된다
  return (
    <CollectPanel
      key={project.id}
      project={project}
      picker={
        <SelectField label="비교할 우리 제품">
          <select className={bigSelectClass} value={project.id} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.name}
              </option>
            ))}
          </select>
        </SelectField>
      }
    />
  );
}
