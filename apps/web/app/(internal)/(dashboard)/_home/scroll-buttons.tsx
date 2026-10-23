"use client";

// 홈 전용: 오른쪽 아래에 늘 떠 있는 맨 위로 · 맨 아래로 버튼 (참고: 나무위키 오른쪽 아래 화살표).
// 스크롤해도 같은 자리에 있도록 화면에 고정한다.
import { ArrowDown, ArrowUp } from "lucide-react";
import { useRef } from "react";

const TEXT = {
  top: "맨 위로",
  bottom: "맨 아래로",
};

const BUTTON = "flex size-10 items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground";

/** 움직임 줄이기를 켠 사용자에게는 미끄러지지 않고 바로 이동한다 */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}

export function ScrollButtons() {
  const ref = useRef<HTMLDivElement>(null);

  // 페이지는 창이 아니라 레이아웃의 <main>이 스크롤한다
  function scrollMain(to: "top" | "bottom") {
    const main = ref.current?.closest("main");
    main?.scrollTo({ top: to === "top" ? 0 : main.scrollHeight, behavior: scrollBehavior() });
  }

  return (
    <div
      ref={ref}
      className="fixed right-6 bottom-6 z-40 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-sm"
    >
      <button type="button" aria-label={TEXT.top} title={TEXT.top} onClick={() => scrollMain("top")} className={BUTTON}>
        <ArrowUp aria-hidden className="size-4" />
      </button>
      <button
        type="button"
        aria-label={TEXT.bottom}
        title={TEXT.bottom}
        onClick={() => scrollMain("bottom")}
        className={`${BUTTON} border-t border-border`}
      >
        <ArrowDown aria-hidden className="size-4" />
      </button>
    </div>
  );
}
