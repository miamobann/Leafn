import { z } from "zod";
import { DateOnly, Timestamp, WorkspaceRow } from "./common";

// (참조 I)
export const PromoEvent = WorkspaceRow.extend({
  platform: z.string(),
  title: z.string(),
  start_date: DateOnly,
  end_date: DateOnly,
  prep_due_date: DateOnly,
  memo: z.string().nullable(),
  // 제안: docs/prototype-plan.md 8장 12번
  kind: z.enum(["platform_event", "own_campaign"]).optional(),
  milestones: z.array(z.object({ label: z.string(), due_date: DateOnly, done_at: Timestamp.nullable().optional() })).optional(),
  /** false = 플랫폼 공지 전 예상 일정 (promo_events.is_confirmed) */
  is_confirmed: z.boolean().optional(),
});
export type PromoEvent = z.infer<typeof PromoEvent>;

/** 캘린더의 "행사 추가" 입력 (확정 프레임: promo_events + promo_milestones) */
export const PromoEventInput = z
  .object({
    platform: z.string().nullable(),
    kind: z.enum(["platform_event", "own_campaign"]),
    title: z.string().trim().min(1, "행사 이름을 적어 주세요"),
    start_date: DateOnly,
    end_date: DateOnly,
    is_confirmed: z.boolean(),
    milestones: z.array(z.object({ label: z.string().trim().min(1), due_date: DateOnly })),
  })
  .refine((e) => e.end_date >= e.start_date, { message: "종료일이 시작일보다 빠릅니다", path: ["end_date"] });
export type PromoEventInput = z.infer<typeof PromoEventInput>;

/** 행사 수정 (상세 패널의 「수정」). 플랫폼·종류는 바꾸지 않는다 */
export const PromoEventPatch = z
  .object({
    title: z.string().trim().min(1, "행사 이름을 적어 주세요"),
    start_date: DateOnly,
    end_date: DateOnly,
    is_confirmed: z.boolean(),
  })
  .refine((e) => e.end_date >= e.start_date, { message: "종료일이 시작일보다 빠릅니다", path: ["end_date"] });
export type PromoEventPatch = z.infer<typeof PromoEventPatch>;

/** 준비 마감 추가 · 수정 */
export const MilestoneInput = z.object({
  label: z.string().trim().min(1, "마감 이름을 적어 주세요"),
  due_date: DateOnly,
});
export type MilestoneInput = z.infer<typeof MilestoneInput>;
