"use client";

import { CircleHelp } from "lucide-react";
import { useSyncExternalStore, type ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const ICON_CLASS =
  "inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full align-middle text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring";

// 브라우저에서 화면이 붙은(hydration) 뒤에만 true. 서버와 첫 렌더는 false
const noop = () => () => {};
function useMounted(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

/**
 * 제목 옆 「?」: 커서를 올리면(키보드는 Tab으로 초점) 이게 무엇인지·어디서 온 데이터인지 설명을 보여 준다.
 * 화면에 설명 글을 늘어놓지 않으려고 쓴다. 꼭 봐야 하는 경고(오류·샘플 표시 등)는 여기에 숨기지 않는다.
 *
 * 툴팁(Base UI)은 useId로 id를 만드는데, 로그인 화면에서 서버와 브라우저의 id가 달라 hydration 경고가 났다 (2026-10-25).
 * 그래서 서버에서는 아이콘만 그리고, 브라우저에 붙은 뒤에 툴팁을 단다 (id가 서버 HTML에 없어 어긋날 일이 없다)
 */
export function HelpTip({
  children,
  label = "설명 보기",
  inline = false,
}: {
  children: ReactNode;
  label?: string;
  /** 버튼 안에 넣을 때 (버튼 안에 버튼을 둘 수 없어 span으로 그린다. 마우스로만 열린다) */
  inline?: boolean;
}) {
  const mounted = useMounted();
  const icon = <CircleHelp className="size-4" aria-hidden />;
  if (!mounted) {
    return (
      <span aria-hidden className={ICON_CLASS}>
        {icon}
      </span>
    );
  }
  return (
    <Tooltip>
      <TooltipTrigger render={inline ? <span /> : undefined} aria-label={label} className={ICON_CLASS}>
        {icon}
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="block max-w-sm space-y-1 text-left text-xs leading-relaxed font-normal whitespace-normal">
        {children}
      </TooltipContent>
    </Tooltip>
  );
}
