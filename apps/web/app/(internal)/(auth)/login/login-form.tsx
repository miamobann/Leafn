"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { signIn, type FormState } from "../actions";

const TEXT = {
  email: "이메일",
  password: "비밀번호",
  submit: "로그인",
  pending: "로그인 중…",
};

export function LoginForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(signIn, { error: null });
  return (
    <form action={action} className="space-y-3">
      <Input id="login-email" name="email" type="email" autoComplete="email" placeholder={TEXT.email} required />
      <Input id="login-password" name="password" type="password" autoComplete="current-password" placeholder={TEXT.password} required />
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
