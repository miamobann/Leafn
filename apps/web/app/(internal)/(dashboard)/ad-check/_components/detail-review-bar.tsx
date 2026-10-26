"use client";

import { useState } from "react";
import type { ReviewStatus } from "@/lib/schemas/common";
import { updateAdCheckReview } from "../_lib/request";
import { ReviewBar } from "./review-bar";

type DetailReviewBarProps = {
  checkId: string;
  initialFinalText: string;
  initialNote: string;
  initialStatus: ReviewStatus;
  initialExpertRequested: boolean;
  canApprove: boolean;
};

export function DetailReviewBar({
  checkId,
  initialFinalText,
  initialNote,
  initialStatus,
  initialExpertRequested,
  canApprove,
}: DetailReviewBarProps) {
  // 상태는 예전에 정한 것을 보여 주기만 한다 (승인 · 반려는 결재함)
  const status = initialStatus;
  const [expertRequested, setExpertRequested] = useState(initialExpertRequested);
  const [note, setNote] = useState(initialNote);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  async function persist(nextStatus: ReviewStatus, nextExpert: boolean, nextNote: string) {
    if (!canApprove) return;
    setSaveState("saving");
    setSaveError(null);
    const res = await updateAdCheckReview(checkId, {
      review_status: nextStatus,
      is_expert_review_requested: nextExpert,
      reviewer_note: nextNote.trim() || null,
      final_text: initialFinalText,
    });
    if (res.ok) {
      setSaveState("saved");
    } else {
      setSaveState("error");
      setSaveError(res.error);
    }
  }

  return (
    <ReviewBar
      finalText={initialFinalText}
      showFinalText={false}
      note={note}
      onNoteChange={setNote}
      status={status}
      expertRequested={expertRequested}
      canApprove={canApprove}
      saveState={saveState}
      saveError={saveError}
      onExpertToggle={() => {
        const nextExpert = !expertRequested;
        setExpertRequested(nextExpert);
        void persist(status, nextExpert, note);
      }}
      onSaveNote={() => void persist(status, expertRequested, note)}
    />
  );
}
