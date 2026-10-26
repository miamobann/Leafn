import { z } from "zod";
import { readRows, dataContext } from "./db";
import { platformLabel } from "@/lib/platforms";
// 진출 실행 탭(플랫폼별 강점, 프로모션 캘린더)이 부르는 읽기·쓰기 함수.
// 화면은 아래 View 타입만 안다. 테이블 구조(slug, platforms FK, promo_milestones)가 바뀌면 이 파일만 고친다.
import { PROTOTYPE_TODAY } from "@/lib/mock/helpers";
import type { ReviewStatus } from "@/lib/schemas/common";
import { getMemberName, getPlatforms, getPromoEvents, getAdChecks } from "./index";

export type ChannelType = "ec" | "review_sns" | "offline";
export type PlatformStatus = "reviewing" | "preparing" | "live";

export type PlatformView = {
  id: string;
  /** 행사·다른 탭과 플랫폼을 맞추는 키. 지금은 표시 이름, slug 합의 후 slug */
  key: string;
  name: string;
  channel: ChannelType | null;
  status: PlatformStatus | null;
  strengths: string;
  audience: string;
  feesNote: string | null;
  memo: string | null;
  updatedBy: string;
};

export type MilestoneView = { id: string; label: string; dueDate: string; done: boolean };

export type PromoEventView = {
  id: string;
  platformKey: string | null;
  platformName: string;
  kind: "platform_event" | "own_campaign";
  title: string;
  startDate: string;
  endDate: string;
  milestones: MilestoneView[];
  /** 이 행사용 광고 문구 검토 (TAB 3). 없으면 null */
  adCheck: { id: string; status: ReviewStatus } | null;
  /** false = 플랫폼 공지 전 예상 일정 */
  isConfirmed: boolean;
  /** 이 행사를 가리키는 광고 검토 수 (콘텐츠 가이드 검사 포함). 행사를 지우면 연결만 끊긴다 */
  linkedAdChecks: number;
};

export async function getPlatformViews(): Promise<PlatformView[]> {
  return Promise.all(
    (await getPlatforms()).map(async (p) => ({
      id: p.id,
      key: p.platform,
      name: platformLabel(p.platform),
      channel: p.channel_type ?? null,
      status: p.status ?? null,
      strengths: p.strengths,
      audience: p.audience,
      feesNote: p.fees_note,
      memo: p.memo ?? null,
      updatedBy: await getMemberName(p.updated_by),
    })),
  );
}

export async function getPlatformView(id: string): Promise<PlatformView | null> {
  return (await getPlatformViews()).find((p) => p.id === id) ?? null;
}

export async function getPromoEventViews(opts: { platformKey?: string } = {}): Promise<PromoEventView[]> {
  const rows = await readRows("promo_milestones");
  const deadlines = rows ? z.array(z.object({ id: z.string(), promo_event_id: z.string(), label: z.string(), due_date: z.string(), done_at: z.string().nullable() })).parse(rows) : null;
  const [checks, allChecks] = await Promise.all([getAdChecks(), getAdChecks({ source: "all" })]);
  return (await getPromoEvents())
    .filter((e) => !opts.platformKey || e.platform === opts.platformKey)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date))
    .map((e) => {
      const check = checks.find((c) => c.promo_event_id === e.id);
      const milestones = e.milestones ?? [{ label: "준비 마감", due_date: e.prep_due_date }];
      return {
        id: e.id,
        platformKey: e.platform,
        platformName: e.platform ? platformLabel(e.platform) : "자사 캠페인",
        kind: e.kind ?? "platform_event",
        title: e.title,
        startDate: e.start_date,
        endDate: e.end_date,
        milestones: deadlines ? deadlines.filter((m) => m.promo_event_id === e.id).map((m) => ({ id: m.id, label: m.label, dueDate: m.due_date, done: m.done_at !== null })) : milestones.map((m, i) => ({ id: `${e.id}-m${i}`, label: m.label, dueDate: m.due_date, done: false })),
        adCheck: check ? { id: check.id, status: check.review_status } : null,
        // 확정 여부가 비어 있으면 팀이 날짜를 정하는 자사 캠페인만 확정으로 본다
        isConfirmed: e.is_confirmed ?? e.kind === "own_campaign",
        linkedAdChecks: allChecks.filter((c) => c.promo_event_id === e.id).length,
      };
    });
}

/** 캘린더의 "오늘". 프로토타입은 샘플 날짜에 맞춘 고정값, DB 연결 후 실제 오늘 */
export async function getToday(): Promise<string> {
  return await dataContext() ? new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date()) : PROTOTYPE_TODAY;
}

/** 가장 이른 미완료 마감 (화면의 "준비 마감") */
export function nextMilestone(e: PromoEventView): MilestoneView | null {
  return e.milestones.filter((m) => !m.done).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}
