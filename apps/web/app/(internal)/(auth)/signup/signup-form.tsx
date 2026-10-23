"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signUp, type SignUpState } from "../actions";

const TEXT = {
  name: "이름 (팀원에게 보이는 이름)",
  email: "이메일",
  password: "비밀번호 (8자 이상)",
  submit: "가입하기",
  pending: "가입 중…",
  sent: (email: string) => `${email}로 확인 메일을 보냈습니다. 메일의 링크를 누르면 가입이 끝나고 워크스페이스 화면으로 이동합니다.`,
  spam: "메일이 안 보이면 스팸함을 확인해 주세요.",
};

export function SignupForm() {
  const [state, action, pending] = useActionState<SignUpState, FormData>(signUp, { error: null });

  if (state.sentTo) {
    return (
      <div role="status" className="space-y-2 rounded-md border border-border p-4 text-sm">
        <p>{TEXT.sent(state.sentTo)}</p>
        <p className="text-muted-foreground">{TEXT.spam}</p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Input id="signup-name" name="display_name" autoComplete="name" placeholder={TEXT.name} maxLength={40} required />
      <Input id="signup-email" name="email" type="email" autoComplete="email" placeholder={TEXT.email} required />
      <Input
        id="signup-password"
        name="password"
        type="password"
        autoComplete="new-password"
        placeholder={TEXT.password}
        minLength={8}
        required
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? TEXT.pending : TEXT.submit}
      </Button>
    </form>
  );
}
