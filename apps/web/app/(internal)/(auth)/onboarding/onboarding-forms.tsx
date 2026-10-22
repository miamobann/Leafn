"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createWorkspace, joinWorkspace, type FormState } from "../actions";

const TEXT = {
  createTitle: "새 워크스페이스 만들기",
  createHint: "만든 사람이 소유자(owner)가 됩니다.",
  name: "팀 이름 (예: Leafn 해외사업팀)",
  create: "만들기",
  joinTitle: "초대 코드로 참여",
  code: "초대 코드",
  join: "참여하기",
};

function ErrorText({ state }: { state: FormState }) {
  return state.error ? (
    <p role="alert" className="text-sm text-destructive">
      {state.error}
    </p>
  ) : null;
}

export function OnboardingForms() {
  const [createState, createAction, creating] = useActionState<FormState, FormData>(createWorkspace, { error: null });
  const [joinState, joinAction, joining] = useActionState<FormState, FormData>(joinWorkspace, { error: null });
  return (
    <div className="space-y-8 text-sm">
      <form action={createAction} className="space-y-2">
        <p className="font-medium">{TEXT.createTitle}</p>
        <p className="text-xs text-muted-foreground">{TEXT.createHint}</p>
        <Input id="ws-name" name="name" placeholder={TEXT.name} maxLength={80} required />
        <ErrorText state={createState} />
        <Button type="submit" className="w-full" disabled={creating}>
          {TEXT.create}
        </Button>
      </form>
      <form action={joinAction} className="space-y-2">
        <p className="font-medium">{TEXT.joinTitle}</p>
        <Input id="ws-code" name="code" placeholder={TEXT.code} required />
        <ErrorText state={joinState} />
        <Button type="submit" variant="outline" className="w-full" disabled={joining}>
          {TEXT.join}
        </Button>
      </form>
    </div>
  );
}
