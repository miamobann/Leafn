"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const noop = () => () => {};

/** 공유 링크의 ?src=(유입 경로)를 문항 화면까지 넘긴다 */
export function StartLink({ label }: { label: string }) {
  const src = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get("src"), () => null);
  const href = src ? `/survey/questions?src=${encodeURIComponent(src)}` : "/survey/questions";
  return (
    <Link href={href} className={cn(buttonVariants({ size: "lg" }), "h-12 w-full text-base")}>
      {label}
    </Link>
  );
}
