// 상단 바 알림 패널 "확인할 일" (2026-10-26 홈 새 디자인). 알림 테이블 없이 있는 데이터에서 그때그때 모은다.
// 팀장: 결재 대기 · 문구 승인 대기 · 팀장 확인 전 AI 분석 · 준비 마감. 팀원: 내 시안 결재 결과 · 준비 마감.
// 읽음 기록은 DB에 두지 않고 화면(components/layout/notification-bell.tsx)이 이 브라우저에 기억한다
import { OWN_PRODUCT_LINE } from "@/lib/own-products";
import type { Risk } from "@/lib/schemas/common";
import { SUBMISSION_TAB_LABELS } from "@/lib/schemas/submission";
import { dDay } from "@/lib/format";
import { getAdChecks, getProducts } from "./index";
import { getPromoEventViews, getToday } from "./launch";
import { getAiAnalyses, getApprovalInbox, getMySubmissions, getMyTabs } from "./submissions";

/** tone: 칩 색 (urgent 지난 마감·반려, wait 결재 대기, ok 문구 승인·승인, plain 그 밖) */
export type Notice = {
  /** 종류가 붙은 ID. 화면이 새 소식인지 가릴 때 쓴다 (마감은 지나면 overdue로 바뀌어 다시 새 소식) */
  id: string;
  label: string;
  tone: "urgent" | "wait" | "ok" | "plain";
  title: string;
  /** 일본어 문구면 ja (읽는 소리 · 글꼴) */
  lang?: "ja";
  sub: string;
  /** 오른쪽 끝 짧은 글 (지남 3일 · 6일째 대기 · D-4 · 10-25) */
  when: string;
  href: string;
};

// 다가오는 마감은 7일 안 것만 (홈 할 일 카드의 "곧" 기준과 같다)
const SOON_DAYS = 7;
// 내 시안 결재 결과는 14일 안 것만
const RESULT_DAYS = 14;
// 문구 승인 대기는 2개까지 보이고 나머지는 "외 n건"
const COPY_SHOWN = 2;
const RISK_ORDER: Record<Risk, number> = { high: 0, medium: 1, low: 2 };
const RISK_LABEL: Record<Risk, string> = { high: "위험 높음", medium: "위험 중간", low: "위험 낮음" };
const USAGE = { detail_page: "상세페이지", sns: "SNS", banner: "배너", survey_result: "설문 결과", notify_button: "알림 버튼" };

const addDays = (date: string, days: number) => new Date(Date.parse(date) + days * 86_400_000).toISOString().slice(0, 10);
const daysBetween = (from: string, to: string) => Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
const mmdd = (date: string) => date.slice(5, 10);
/** "Leaf& Dew Deep Skin 리뷰 분석" → "Deep Skin 리뷰 분석" (패널이 좁아 프로젝트 이름은 뺀다) */
const short = (name: string) => (name.startsWith(OWN_PRODUCT_LINE) ? name.slice(OWN_PRODUCT_LINE.length).trim() : name);

/** count = 처리할 일 수 (배지 숫자). 문구 승인은 2개만 목록에 보여도 모두 센다 */
export async function getNotifications(): Promise<{ role: "owner" | "member"; count: number; todo: Notice[]; results: Notice[] }> {
  const [my, events, today] = await Promise.all([getMyTabs(), getPromoEventViews(), getToday()]);

  // 준비 마감은 팀원 누구나 체크하므로 모두에게: 지난 것(오래된 것부터) → 7일 안(가까운 것부터)
  const soon = addDays(today, SOON_DAYS);
  const milestones = events
    .flatMap((e) => e.milestones.filter((m) => !m.done && m.dueDate <= soon).map((m) => ({ ...m, event: e })))
    .toSorted((a, b) => a.dueDate.localeCompare(b.dueDate));
  const deadline = (m: (typeof milestones)[number]): Notice => {
    const overdue = m.dueDate < today;
    return {
      id: `${overdue ? "overdue" : "due"}:${m.id}`,
      label: overdue ? "지난 마감" : "마감",
      tone: overdue ? "urgent" : "plain",
      title: m.label,
      sub: `${m.event.title} · ${mmdd(m.dueDate)}`,
      when: overdue ? `지남 ${daysBetween(m.dueDate, today)}일` : dDay(m.dueDate, today),
      href: `/calendar?event=${m.event.id}`,
    };
  };
  const overdue = milestones.filter((m) => m.dueDate < today).map(deadline);
  const upcoming = milestones.filter((m) => m.dueDate >= today).map(deadline);

  if (my.role !== "owner") {
    // 시안마다 마지막 버전의 결재만 (반려 뒤 다시 올렸으면 옛 반려는 빼고 새 결과를 기다린다)
    const mine = await getMySubmissions();
    const since = addDays(today, -RESULT_DAYS);
    const latest = new Map<string, (typeof mine)[number]>();
    for (const row of mine) {
      const prev = latest.get(row.submission.id);
      if (!prev || row.version.version_no > prev.version.version_no) latest.set(row.submission.id, row);
    }
    const results = [...latest.values()]
      .flatMap((row) => (row.decision && row.decision.created_at.slice(0, 10) >= since ? [{ ...row, decision: row.decision }] : []))
      .toSorted((a, b) => b.decision.created_at.localeCompare(a.decision.created_at))
      .map((row): Notice => {
        const rejected = row.decision.decision === "rejected";
        const name = `${short(row.productName)} ${SUBMISSION_TAB_LABELS[row.submission.tab]} v${row.version.version_no}`;
        return {
          id: `result:${row.decision.id}`,
          label: rejected ? "반려" : "승인",
          tone: rejected ? "urgent" : "ok",
          title: name,
          sub: [row.reviewerName, rejected ? row.decision.reason : `${mmdd(row.decision.created_at)} 승인`].filter(Boolean).join(" · "),
          when: rejected ? "다시 올리기" : mmdd(row.decision.created_at),
          href: `/approvals/${row.version.id}`,
        };
      });
    return { role: "member", count: overdue.length + upcoming.length, todo: [...overdue, ...upcoming], results };
  }

  const [inbox, pending, analyses, products] = await Promise.all([
    getApprovalInbox({ recentLimit: 0 }),
    getAdChecks({ status: "pending" }),
    getAiAnalyses(),
    getProducts({ kind: "own" }),
  ]);
  // 결재함과 같은 순서 (오래 기다린 것부터)
  const approvals = inbox.pending.map(
    (r): Notice => ({
      id: `approval:${r.version.id}`,
      label: "결재",
      tone: "wait",
      title: `${short(r.productName)} ${SUBMISSION_TAB_LABELS[r.submission.tab]} v${r.version.version_no}`,
      sub: `${r.authorName} · ${mmdd(r.version.submitted_at ?? r.version.created_at)} 제출`,
      when: `${r.waitingDays}일째 대기`,
      href: `/approvals/${r.version.id}`,
    }),
  );
  // 문구 검토 대기 카드와 같은 순서 (위험이 높은 것부터, 같으면 최근 것부터)
  const productName = new Map(products.map((p) => [p.id, short(p.name)]));
  const copies = pending
    .toSorted((a, b) => RISK_ORDER[a.overall_risk ?? "low"] - RISK_ORDER[b.overall_risk ?? "low"] || b.created_at.localeCompare(a.created_at))
    .slice(0, COPY_SHOWN)
    .map((a, i, shown): Notice => {
      const more = i === shown.length - 1 && pending.length > COPY_SHOWN ? `외 ${pending.length - COPY_SHOWN}건` : null;
      const where = (a.product_id ? productName.get(a.product_id) : undefined) ?? (a.usage ? USAGE[a.usage] : null);
      return {
        id: `copy:${a.id}`,
        label: "문구 승인",
        tone: "ok",
        title: a.input_text,
        lang: a.input_lang === "ja" ? "ja" : undefined,
        sub: [where, a.overall_risk ? RISK_LABEL[a.overall_risk] : null, more].filter(Boolean).join(" · "),
        when: mmdd(a.created_at),
        href: `/ad-check/${a.id}`,
      };
    });
  const unchecked = analyses
    .filter((a) => !a.lead_checked_at)
    .map(
      (a): Notice => ({
        id: `ai:${a.id}`,
        label: "AI 분석",
        tone: "plain",
        title: short(a.title),
        sub: "팀장 확인 전",
        when: mmdd(a.created_at),
        href: `/ai-analysis/${a.id}`,
      }),
    );
  // 급한 순: 지난 마감 → 결재 대기 → 문구 승인 → AI 분석 확인 → 다가오는 마감
  return {
    role: "owner",
    count: overdue.length + approvals.length + pending.length + unchecked.length + upcoming.length,
    todo: [...overdue, ...approvals, ...copies, ...unchecked, ...upcoming],
    results: [],
  };
}
