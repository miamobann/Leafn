// 번역한 후기가 시안에 담길 수 있는지 판단하는 기준 한 곳 (상세페이지용 리뷰 화면과 시안 저장 서버 함수가 같이 쓴다).
// 문제 표현이 남았거나 담당자가 반려한 검토는 「고쳐야 함」이고, 고치기(대체 표현 적용) 전에는 시안에 담을 수 없다.
import type { AdFinding } from "@/lib/schemas/ad-check";

export function riskyFinding(findings: AdFinding[]): AdFinding | undefined {
  return findings.find((f) => f.risk === "high" || f.action === "must_fix");
}

/** true면 고쳐야 한다 (검토 기록이 없으면 판단할 수 없으니 담을 수 없다) */
export function translationNeedsFix(check: { review_status: string; findings: AdFinding[] } | null | undefined): boolean {
  if (!check) return true;
  return check.review_status === "rejected" || riskyFinding(check.findings) !== undefined;
}
