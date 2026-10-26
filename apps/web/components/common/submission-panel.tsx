"use client";

// 탭 결과 화면 아래의 "시안 · 결재" 패널 (docs/team-approval-ai-analysis.md 3장 1~4, 6장).
// 지금 결과를 「결재 올리기」(저장 + 제출을 한 번에) 하거나 임시 저장한 뒤 제출 → 팀장 결재. 제출한 버전은 고칠 수 없고 새 버전을 만든다.
// 맨 위 한 줄에 지금 팀장 검토 상황을 보인다. 결재함은 팀장만 보고, 팀원은 「내 시안」에서 모아 본다
// 담당 탭이 아니면 히스토리만 보인다 (버튼은 숨기고, DB도 막는다)
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  type DraftInput,
  hideVersion,
  newVersionFrom,
  type SubmissionResult,
  submitVersion,
  updateDraft,
  withdrawVersion,
} from "@/lib/data/submission-actions";
import { formatDate } from "@/lib/format";
import type { Decision, SubmissionStatus, VersionStatus } from "@/lib/schemas/submission";
import { SubmissionStatusBadge, VersionStatusBadge } from "./submission-badges";

const TEXT = {
  title: (tab: string) => `시안 · 결재 (${tab})`,
  readOnly: "담당 탭이 아니라 보기만 할 수 있어요. 담당 탭은 설정에서 팀장이 정해요.",
  sample: "샘플 데이터예요. 로그인한 워크스페이스에서만 저장할 수 있어요.",
  summary: "한 줄 결론",
  summaryPlaceholder: "예) 순한 사용감이 재구매 이유, 자극 후기는 민감 피부에서만",
  note: "메모 (선택)",
  upload: "결재 올리기",
  uploadHint: "지금 결과를 시안으로 저장하고 바로 팀장 결재함에 올려요.",
  save: "임시 저장",
  saving: "저장 중…",
  myList: "내 시안 전체 보기 →",
  state: {
    none: "아직 올린 시안이 없어요.",
    submitted: (no: number) => `v${no} 팀장 결재를 기다리고 있어요.`,
    approved: (no: number) => `v${no}이 승인됐어요. 새 버전을 올려도 승인되기 전까지는 v${no}이 기준이에요.`,
    rejected: (no: number) => `v${no}이 반려됐어요. 사유를 보고 새 버전을 올려 주세요.`,
    draft: "임시 저장만 있어요. 제출해야 팀장 결재함에 올라가요.",
  },
  empty: "아직 시안이 없어요.",
  history: "버전 히스토리",
  rejectedReason: (no: number) => `v${no} 반려 사유`,
  submit: "제출",
  submitNeedsSummary: "한 줄 결론을 적어야 제출할 수 있어요",
  edit: "결론 · 메모 고치기",
  editHint: (no: number) => `임시 저장된 v${no}의 한 줄 결론과 메모를 고쳐요. 담은 소구점 · 후기는 그대로예요. 다 쓰면 저장한 뒤 「제출」을 눌러 주세요.`,
  editSave: "저장",
  cancel: "취소",
  hide: "삭제",
  hideConfirm: (no: number) => `v${no}을 삭제할까요? 목록에서 숨겨지고 되돌릴 수 없어요.`,
  withdraw: "제출 취소",
  newFrom: "이 버전에서 새 버전",
  load: "불러오기",
  loadTitle: "이 버전의 한 줄 결론 · 메모를 위 칸에 복사해요",
  loadContentsTitle: "이 버전의 한 줄 결론 · 메모와 담은 내용을 지금 시안으로 복사해요",
  loadConfirm: (no: number) => `지금 임시 저장 중인 시안의 담은 내용이 v${no}의 구성으로 바뀌어요. 불러올까요?`,
  loaded: (no: number) => `v${no}의 한 줄 결론 · 메모를 불러왔어요. 고칠 부분만 고친 뒤 올리면 새 버전이 돼요 (v${no}은 그대로 남아요).`,
  loadedContents: (no: number, draftNo: number) =>
    `v${no}의 한 줄 결론 · 메모와 담은 내용을 임시 v${draftNo}로 불러왔어요. 고칠 부분만 고친 뒤 올리면 돼요 (v${no}은 그대로 남아요).`,
  preview: "미리보기",
  dataAsOf: "데이터 기준",
  self: "자기 결재",
};

export type VersionView = {
  id: string;
  version_no: number;
  status: VersionStatus;
  summary: string;
  note: string | null;
  author_id: string | null;
  author_name: string;
  created_at: string;
  submitted_at: string | null;
  data_as_of: string | null;
  decision: { decision: Decision; reason: string | null; reviewer_name: string; decided_at: string; is_self_review: boolean } | null;
};

export type SaveDraft = (input: DraftInput & { carryOver: boolean }) => Promise<SubmissionResult<{ versionId: string }>>;

export function SubmissionPanel({
  tabLabel,
  status,
  versions,
  canEdit,
  isOwner,
  meId,
  sampleMode,
  saveDraft,
  snapshotNote,
  carryOverLabel,
  loadContents,
  className = "mt-6",
}: {
  tabLabel: string;
  status: SubmissionStatus | null;
  versions: VersionView[];
  canEdit: boolean;
  isOwner: boolean;
  meId: string | null;
  sampleMode: boolean;
  saveDraft: SaveDraft;
  /** 무엇이 스냅샷으로 저장되는지 한 줄 */
  snapshotNote: string;
  /** 있으면 "직전 버전 내용도 함께 담기" 체크를 보인다 (광고 검토) */
  carryOverLabel?: string;
  /** 있으면 「불러오기」가 글뿐 아니라 그 버전의 담은 내용도 지금 임시 버전으로 복사한다 (리뷰 분석) */
  loadContents?: (versionId: string) => Promise<SubmissionResult<{ versionNo: number; summary: string; note: string }>>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [note, setNote] = useState("");
  // 히스토리의 「불러오기」로 이전 버전의 글을 위 칸에 복사해 고쳐 올린다. 원래 버전은 건드리지 않는다
  const [loadedFrom, setLoadedFrom] = useState<{ from: number; draftNo: number | null } | null>(null);
  const summaryRef = useRef<HTMLTextAreaElement>(null);
  const fill = (from: number, draftNo: number | null, text: { summary: string; note: string }) => {
    setSummary(text.summary);
    setNote(text.note);
    setLoadedFrom({ from, draftNo });
    summaryRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    summaryRef.current?.focus({ preventScroll: true });
  };
  const loadVersion = (v: VersionView) => {
    setError(null);
    if (!loadContents) {
      fill(v.version_no, null, { summary: v.summary, note: v.note ?? "" });
      return;
    }
    // 지금 임시 버전이 있으면 그 담은 내용을 덮어쓰므로 한 번 묻는다
    if (versions[0]?.status === "draft" && versions[0].id !== v.id && !window.confirm(TEXT.loadConfirm(v.version_no))) return;
    let loaded: { versionNo: number; summary: string; note: string } | null = null;
    run(
      async () => {
        const res = await loadContents(v.id);
        if (res.ok) loaded = res.data;
        return res;
      },
      () => {
        if (loaded) fill(v.version_no, loaded.versionNo, loaded);
      },
    );
  };
  const [carryOver, setCarryOver] = useState(true);
  const [mode, setMode] = useState<"upload" | "save">("upload");
  const [editing, setEditing] = useState<{ id: string; summary: string; note: string } | null>(null);

  const disabled = sampleMode || pending;
  // 가장 최근에 결재된 버전이 반려면 사유를 위에 보인다 (설계 6장: 반려 사유는 다음 버전을 만들 때 보인다)
  const latestDecided = versions.find((v) => v.status === "approved" || v.status === "rejected");
  // 팀장 검토 상황 한 줄: 결재 대기가 있으면 그것, 없으면 가장 최근 결재, 없으면 임시 저장 여부
  const waiting = versions.find((v) => v.status === "submitted");
  const stateLine = waiting
    ? TEXT.state.submitted(waiting.version_no)
    : latestDecided
      ? TEXT.state[latestDecided.status === "approved" ? "approved" : "rejected"](latestDecided.version_no)
      : versions.some((v) => v.status === "draft")
        ? TEXT.state.draft
        : TEXT.state.none;

  function run(action: () => Promise<SubmissionResult<unknown>>, after?: () => void) {
    setError(null);
    startTransition(async () => {
      const result = await action();
      if (!result.ok) {
        setError(result.message);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  // 미리보기는 팀장 · 작성자 · 승인본만 (버전 미리보기 화면과 DB가 같은 규칙)
  const canPreview = (v: VersionView) => sampleMode || isOwner || v.status === "approved" || (v.author_id !== null && v.author_id === meId);
  const canActOn = (v: VersionView) => !sampleMode && (isOwner || (canEdit && v.author_id !== null && v.author_id === meId));

  return (
    <Card id="submission" className={`scroll-mt-6 ${className}`}>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle className="text-base">{TEXT.title(tabLabel)}</CardTitle>
        <span className="flex items-center gap-3">
          {status && <SubmissionStatusBadge status={status} />}
          <Link href="/approvals/mine" className="text-sm text-muted-foreground underline-offset-4 hover:underline">
            {TEXT.myList}
          </Link>
        </span>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm font-medium">{stateLine}</p>
        {sampleMode && <p className="text-sm text-muted-foreground">{TEXT.sample}</p>}
        {!canEdit && !sampleMode && <p className="text-sm text-muted-foreground">{TEXT.readOnly}</p>}

        {latestDecided?.status === "rejected" && latestDecided.decision?.reason && (
          <div role="note" className="rounded-md border border-status-rejected/40 bg-status-rejected/5 p-3 text-sm">
            <p className="font-medium">{TEXT.rejectedReason(latestDecided.version_no)}</p>
            <p className="mt-1 whitespace-pre-line">{latestDecided.decision.reason}</p>
          </div>
        )}

        {canEdit && (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (mode === "upload" && !summary.trim()) {
                setError(TEXT.submitNeedsSummary);
                return;
              }
              run(
                async () => {
                  const saved = await saveDraft({ summary, note: note.trim() || null, carryOver });
                  // 결재 올리기 = 저장한 임시 버전을 바로 제출. 제출이 실패해도 임시 버전은 남아 히스토리에서 다시 제출할 수 있다
                  if (!saved.ok || mode === "save") return saved;
                  return submitVersion(saved.data.versionId);
                },
                () => {
                  setSummary("");
                  setNote("");
                  setLoadedFrom(null);
                },
              );
            }}
          >
            <p className="text-sm text-muted-foreground">
              {TEXT.uploadHint} {snapshotNote}
            </p>
            {loadedFrom !== null && (
              <p role="status" className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                {loadedFrom.draftNo === null ? TEXT.loaded(loadedFrom.from) : TEXT.loadedContents(loadedFrom.from, loadedFrom.draftNo)}
              </p>
            )}
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{TEXT.summary}</span>
              <Textarea
                ref={summaryRef}
                value={summary}
                maxLength={300}
                rows={2}
                placeholder={TEXT.summaryPlaceholder}
                onChange={(e) => setSummary(e.target.value)}
              />
            </label>
            <label className="block space-y-1 text-sm">
              <span className="font-medium">{TEXT.note}</span>
              <Input value={note} maxLength={1000} onChange={(e) => setNote(e.target.value)} />
            </label>
            {carryOverLabel && versions.length > 0 && (
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={carryOver} onCheckedChange={(on) => setCarryOver(on)} />
                {carryOverLabel}
              </label>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" disabled={disabled} onClick={() => setMode("upload")}>
                {pending && mode === "upload" ? TEXT.saving : TEXT.upload}
              </Button>
              <Button type="submit" variant="outline" disabled={disabled} onClick={() => setMode("save")}>
                {pending && mode === "save" ? TEXT.saving : TEXT.save}
              </Button>
            </div>
          </form>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <section className="space-y-2">
          <h3 className="text-sm font-semibold">{TEXT.history}</h3>
          {versions.length === 0 && <p className="text-sm text-muted-foreground">{TEXT.empty}</p>}
          <ol className="space-y-2">
            {versions.map((v) => (
              <li key={v.id} className="rounded-md border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">v{v.version_no}</span>
                  <VersionStatusBadge status={v.status} />
                  <span className="text-muted-foreground">
                    {v.author_name} · {formatDate(v.submitted_at ?? v.created_at)}
                    {v.data_as_of && ` · ${TEXT.dataAsOf} ${formatDate(v.data_as_of)}`}
                  </span>
                  <span className="ml-auto flex items-center gap-3">
                    {canEdit && !sampleMode && (v.summary || v.note) && (
                      <button type="button" title={loadContents ? TEXT.loadContentsTitle : TEXT.loadTitle} disabled={disabled} onClick={() => loadVersion(v)} className="text-sm font-medium text-primary underline-offset-4 hover:underline">
                        {TEXT.load}
                      </button>
                    )}
                    {canPreview(v) && (
                      <Link href={`/approvals/${v.id}`} className="text-sm underline-offset-4 hover:underline">
                        {TEXT.preview}
                      </Link>
                    )}
                  </span>
                </div>

                {editing?.id === v.id ? (
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted-foreground">{TEXT.editHint(v.version_no)}</p>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{TEXT.summary}</span>
                      <Textarea
                        value={editing.summary}
                        maxLength={300}
                        rows={2}
                        placeholder={TEXT.summaryPlaceholder}
                        onChange={(e) => setEditing({ ...editing, summary: e.target.value })}
                      />
                    </label>
                    <label className="block space-y-1 text-sm">
                      <span className="font-medium">{TEXT.note}</span>
                      <Input value={editing.note} maxLength={1000} onChange={(e) => setEditing({ ...editing, note: e.target.value })} />
                    </label>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        disabled={disabled}
                        onClick={() =>
                          run(
                            () => updateDraft(v.id, { summary: editing.summary, note: editing.note.trim() || null }),
                            () => setEditing(null),
                          )
                        }
                      >
                        {TEXT.editSave}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setEditing(null)}>
                        {TEXT.cancel}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    {v.summary && <p className="mt-1">{v.summary}</p>}
                    {v.note && <p className="mt-1 text-muted-foreground">{v.note}</p>}
                  </>
                )}

                {v.decision && (
                  <p className="mt-1 text-muted-foreground">
                    {v.decision.reviewer_name} · {formatDate(v.decision.decided_at)}
                    {v.decision.is_self_review && ` · ${TEXT.self}`}
                    {v.decision.reason && ` · ${v.decision.reason}`}
                  </p>
                )}

                {canActOn(v) && editing?.id !== v.id && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {v.status === "draft" && (
                      <>
                        <Button
                          size="sm"
                          disabled={disabled || !v.summary.trim()}
                          title={v.summary.trim() ? undefined : TEXT.submitNeedsSummary}
                          onClick={() => run(() => submitVersion(v.id))}
                        >
                          {TEXT.submit}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={disabled}
                          onClick={() => setEditing({ id: v.id, summary: v.summary, note: v.note ?? "" })}
                        >
                          {TEXT.edit}
                        </Button>
                      </>
                    )}
                    {v.status === "submitted" && (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => run(() => withdrawVersion(v.id))}>
                        {TEXT.withdraw}
                      </Button>
                    )}
                    {v.status !== "draft" && canEdit && (
                      <Button size="sm" variant="outline" disabled={disabled} onClick={() => run(() => newVersionFrom(v.id))}>
                        {TEXT.newFrom}
                      </Button>
                    )}
                    {v.status !== "approved" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={disabled}
                        onClick={() => {
                          if (window.confirm(TEXT.hideConfirm(v.version_no))) run(() => hideVersion(v.id));
                        }}
                      >
                        {TEXT.hide}
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      </CardContent>
    </Card>
  );
}
