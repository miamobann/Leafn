// 진출 실행 탭(플랫폼별 강점, 프로모션 캘린더)이 부르는 읽기·쓰기 함수.
// 화면은 아래 View 타입만 안다. 테이블 구조(slug, platforms FK, promo_milestones)가 바뀌면 이 파일만 고친다.
import { mock } from "@/lib/mock";
import type { ReviewStatus } from "@/lib/schemas/common";
import { getMemberName } from "./index";

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
};

export async function getPlatformViews(): Promise<PlatformView[]> {
  return Promise.all(
    mock.platforms.map(async (p) => ({
      id: p.id,
      key: p.platform,
      name: p.platform,
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
  return mock.promoEvents
    .filter((e) => !opts.platformKey || e.platform === opts.platformKey)
    .toSorted((a, b) => a.start_date.localeCompare(b.start_date))
    .map((e) => {
      const check = mock.adChecks.find((c) => c.promo_event_id === e.id);
      const milestones = e.milestones ?? [{ label: "준비 마감", due_date: e.prep_due_date }];
      return {
        id: e.id,
        platformKey: e.platform,
        platformName: e.platform,
        kind: e.kind ?? "platform_event",
        title: e.title,
        startDate: e.start_date,
        endDate: e.end_date,
        milestones: milestones.map((m, i) => ({ id: `${e.id}-m${i}`, label: m.label, dueDate: m.due_date, done: false })),
        adCheck: check ? { id: check.id, status: check.review_status } : null,
      };
    });
}

/** 가장 이른 미완료 마감 (화면의 "준비 마감") */
export function nextMilestone(e: PromoEventView): MilestoneView | null {
  return e.milestones.filter((m) => !m.done).toSorted((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}
