"use client";

// 플랫폼 수집 화면: ① 비교할 우리 제품과 조건을 고르고 → ② 경쟁 제품 목록을 불러와 저장할 제품을 고르고 → ③ 리뷰를 저장한다.
// 용어: "불러오기" = 수집 요청을 만들고 수집기가 읽어 온 목록을 미리보기로 받는 것 (아직 저장되지 않는다). "저장" = 미리보기를 DB(reviews)에 확정하는 것.
// 상태와 서버 호출은 use-collection.ts, 조건 칸은 collect-conditions.tsx, 결과 표는 collect-table.tsx에 있다.
import Link from "next/link";
import { type ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CollectProject } from "@/lib/data/collection";
import { Conditions } from "./collect-conditions";
import { METHOD, TEXT, WORKER_COMMAND } from "./collect-options";
import { DOT, Field, n, selectClass, StepBar } from "./collect-parts";
import { ResultTable, SkippedList } from "./collect-table";
import { IMPORT_PLATFORMS } from "./import-platforms";
import { useCollection } from "./use-collection";

const WORKER_HINT_MS = 15000; // 이 시간이 지나도 수집기가 집어 가지 않으면 켜 보라고 안내한다

function CollectPanel({ project, picker }: { project: CollectProject; picker: ReactNode }) {
  const c = useCollection(project);
  const { form, view, status, busy, selected } = c;

  const rows = view && (view.run.status === "ready" || view.run.status === "saved") ? view.rows : null;
  const saved = status === "saved";
  const stage: 1 | 2 | 3 = !view || status === "failed" ? 1 : saved ? 3 : 2;
  const locked = busy !== null || c.restoring || view !== null; // 요청이 있는 동안은 조건을 바꾸지 않는다 (바꾸려면 "다시 불러오기")
  const platform = IMPORT_PLATFORMS.find((p) => p.id === form.platformId);
  const shownStars = view?.run.stars ?? form.stars.toSorted((a, b) => a - b);
  const starLabel = `${shownStars.join("·")}점`;
  const chosen = rows?.filter((r) => selected.has(r.id)) ?? [];
  const upTo = chosen.reduce((sum, r) => sum + r.newCount, 0); // 이번에 새로 저장될 수 있는 리뷰 수 (이미 저장된 것은 이미 뺀 값이다)
  const fullySaved = rows?.filter((r) => !r.failed && r.savedCount > 0 && r.newCount === 0).length ?? 0;
  const partlySaved = rows?.filter((r) => !r.failed && r.savedCount > 0 && r.newCount > 0).length ?? 0;
  const savedNow = rows?.reduce((sum, r) => sum + (r.savedNow ?? 0), 0) ?? 0;
  const queuedTooLong = status === "queued" && view !== null && c.now - Date.parse(view.run.createdAt) > WORKER_HINT_MS;
  const spec = [project.category, project.volumeMl ? `${project.volumeMl}ml` : null, project.priceJpy ? `${project.priceJpy.toLocaleString("en-US")}円` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <Card>
      <CardHeader>
        <CardTitle>{TEXT.title}</CardTitle>
        <p className="text-sm text-muted-foreground">{TEXT.intro}</p>
        <StepBar stage={stage} />
      </CardHeader>
      <CardContent className="space-y-4">
        <Conditions picker={picker} form={form} shownStars={shownStars} locked={locked} onChange={c.setForm} />
        <p className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            {project.brand} {project.name}
          </span>
          {spec && <> ({spec})</>}의 경쟁 제품으로 저장돼요.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          {!view ? (
            <>
              <Button onClick={c.find} disabled={locked || form.stars.length === 0}>
                {busy === "start" ? TEXT.finding : TEXT.find}
              </Button>
              <span className="text-xs text-muted-foreground">{form.stars.length === 0 ? "가져올 별점을 하나 이상 골라 주세요." : TEXT.findHint}</span>
            </>
          ) : (
            <Button variant="outline" onClick={c.reset} disabled={busy !== null || status === "running"}>
              {busy === "reset" ? "정리하는 중…" : saved ? "새로 불러오기" : TEXT.again}
            </Button>
          )}
        </div>

        {c.message && <p className="rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-3 text-sm">{c.message}</p>}

        <details className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <summary className="cursor-pointer font-medium text-foreground">어떻게 가져오나요?</summary>
          <ul className="mt-2 list-disc space-y-1 pl-4">
            <li>{platform ? METHOD[platform.id] : null}</li>
            <li>체크한 별점마다 따로 읽어요. 체크하지 않은 별점은 읽지 않아요. 리뷰는 별점 안에서 최신순이에요.</li>
            <li>이미 저장한 리뷰는 건너뛰고, 아직 없는 리뷰를 별점마다 “새로 N건”씩 가져와요. 같은 설정으로 다시 불러오면 그다음으로 최근 리뷰가 들어와요.</li>
            <li>“3점 40건 이상”은 Qoo10에 그 별점 리뷰가 최소 그만큼 있다는 뜻이에요.</li>
            <li>별점이 낮아도 배송·누락 같은 제품 외 불만일 수 있어요. 이런 리뷰를 AI가 가려내는 기능은 아직 연결 전이에요.</li>
          </ul>
        </details>

        {c.restoring && <p className="text-sm text-muted-foreground">지난 수집 요청을 확인하는 중…</p>}

        {!view && !c.restoring && !c.message && (
          <div className="flex min-h-32 items-center justify-center rounded-lg border border-dashed p-6 text-sm text-muted-foreground">{TEXT.emptyHint}</div>
        )}

        {view && c.waiting && (
          <div className="space-y-2 rounded-lg border p-4 text-sm">
            <div className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${DOT.busy}`} aria-hidden />
              <span className="font-medium">{status === "queued" ? "수집기가 요청을 기다리고 있어요" : "Qoo10에서 리뷰를 읽는 중이에요"}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              {status === "queued"
                ? "수집기가 켜져 있으면 곧 시작해요."
                : `제품마다 몇 초씩 쉬면서 읽어서 제품 ${view.run.topN}개는 몇 분 걸려요. 이 화면을 닫아도 수집은 계속돼요.`}
            </p>
            {queuedTooLong && (
              <p className="text-xs">
                수집기가 꺼져 있을 수 있어요. 터미널에서 이 명령을 실행해 주세요: <code className="rounded bg-muted px-1 py-0.5">{WORKER_COMMAND}</code>
              </p>
            )}
          </div>
        )}

        {view && status === "failed" && (
          <div className="space-y-1 rounded-lg border border-status-rejected/40 bg-status-rejected/5 p-4 text-sm">
            <p className="font-medium">가져오지 못했어요</p>
            <p className="text-xs text-muted-foreground">{view.run.error ?? "수집기가 이유를 남기지 않았어요."}</p>
          </div>
        )}

        {view && rows && (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium">
                {saved ? `경쟁 제품 ${rows.length}개의 리뷰를 저장했어요.` : `경쟁 제품 ${rows.length}개를 불러왔어요. 리뷰를 저장할 제품을 골라 주세요.`}
              </p>
              <p className="text-xs text-muted-foreground">
                모두 저장됨 {fullySaved}개 · 일부만 저장됨 {partlySaved}개.
                {!saved && " 새로 저장할 리뷰가 있는 제품만 미리 골라 두었어요."}
              </p>
            </div>

            <ResultTable
              rows={rows}
              selected={selected}
              platformLabel={platform?.label ?? "플랫폼"}
              saved={saved}
              busy={busy !== null}
              onToggle={c.toggle}
              onToggleAll={() => c.setSelected(rows.length > 0 && selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)))}
            />

            <SkippedList skipped={view.skipped} />

            {!saved && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 p-3">
                <Button onClick={c.save} disabled={busy !== null || chosen.length === 0}>
                  {busy === "save" ? TEXT.saving : TEXT.save(chosen.length)}
                </Button>
                <span className="text-xs text-muted-foreground">
                  {chosen.length > 0
                    ? `새로 저장될 리뷰는 ${n(upTo)}건이에요 (${starLabel}을 별점마다 새로 최대 ${view.run.reviewLimit}건씩 읽었고, 이미 저장된 리뷰는 뺐어요).`
                    : "저장할 제품을 선택해 주세요."}
                </span>
              </div>
            )}

            {saved && (
              <div className="space-y-2 rounded-lg border border-status-approved/40 bg-status-approved/5 p-3 text-sm">
                <p className="font-medium">
                  저장이 끝났어요 · 제품 {rows.length}개, 새로 저장한 리뷰 {n(view.run.savedCount ?? savedNow)}건
                </p>
                <p className="text-xs text-muted-foreground">이미 저장돼 있던 리뷰는 건너뛰었어요.</p>
                <Link href="/reviews" className="text-xs font-medium text-primary underline underline-offset-4">
                  {TEXT.reportLink}
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// 프로젝트(우리 제품)는 아직 없어서 지금은 드롭다운으로 고른다.
// 홈 화면에서 프로젝트를 고르게 되면 이 드롭다운을 없애고, 선택된 프로젝트 하나를 CollectPanel에 그대로 넘기면 된다.
export function PlatformCollect({ projects }: { projects: CollectProject[] }) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId) ?? projects[0];
  if (!project) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{TEXT.title}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{TEXT.noProjects}</p>
        </CardContent>
      </Card>
    );
  }

  // key가 바뀌면 지난 목록과 제품 종류 기본값이 함께 초기화된다
  return (
    <CollectPanel
      key={project.id}
      project={project}
      picker={
        <Field label={TEXT.project}>
          <select className={selectClass} value={project.id} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} {p.name}
              </option>
            ))}
          </select>
        </Field>
      }
    />
  );
}
