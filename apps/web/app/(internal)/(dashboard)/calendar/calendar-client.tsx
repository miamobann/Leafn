"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// FullCalendar는 브라우저에서만 그린다 (서버 렌더링 시 window가 없음)
export const CalendarClient = dynamic(() => import("./promo-calendar").then((m) => m.PromoCalendar), {
  ssr: false,
  loading: () => <Skeleton className="h-[640px] w-full" />,
});
