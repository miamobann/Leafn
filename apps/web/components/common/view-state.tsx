"use client";

import { useSyncExternalStore } from "react";
import { ViewState } from "@/lib/schemas/common";
import { EmptyState, ErrorState, LoadingState } from "./states";

// 주소에 ?state=empty|loading|error를 붙이면 어느 화면이든 그 상태로 강제한다 (prototype-plan 4.1).
// useSearchParams 대신 window.location을 구독해 정적 렌더링을 막지 않는다.
function subscribe(onChange: () => void) {
  window.addEventListener("popstate", onChange);
  return () => window.removeEventListener("popstate", onChange);
}

function readState(): ViewState {
  const parsed = ViewState.safeParse(new URLSearchParams(window.location.search).get("state"));
  return parsed.success ? parsed.data : "ready";
}

type ViewStateGateProps = {
  /** 데이터가 없을 때 템플릿이 넘기는 기본 상태 */
  state?: ViewState;
  emptyAction?: string;
  children: React.ReactNode;
};

export function ViewStateGate({ state = "ready", emptyAction, children }: ViewStateGateProps) {
  const forced = useSyncExternalStore(subscribe, readState, () => "ready" as const);
  const current = forced === "ready" ? state : forced;

  if (current === "empty") return <EmptyState action={emptyAction} />;
  if (current === "loading") return <LoadingState />;
  if (current === "error") return <ErrorState />;
  return <>{children}</>;
}
