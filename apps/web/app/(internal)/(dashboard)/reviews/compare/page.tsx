import { PageHeader } from "@/components/layout/page-header";
import { ReportTemplate } from "@/components/templates";
import { getAppealCandidates } from "@/lib/data";

export default async function ReviewsComparePage() {
  const { strengths, complaints } = await getAppealCandidates();

  return (
    <>
      <PageHeader title="소구점 찾기" description="국내 리뷰의 강점(자사)과 일본 리뷰의 불만(경쟁) 비교" featureId="E" />
      <ReportTemplate
        cards={[
          {
            title: "국내 강점 (자사)",
            content: (
              <ul className="space-y-1 text-sm">
                {strengths.map((s) => (
                  <li key={s.id}>
                    {s.label} <span className="text-muted-foreground">· 근거 {s.evidence_review_ids.length}건</span>
                  </li>
                ))}
              </ul>
            ),
          },
          {
            title: "일본 불만 (경쟁)",
            content: (
              <ul className="space-y-1 text-sm">
                {complaints.map((c) => (
                  <li key={c.id}>
                    <span lang="ja">{c.label}</span> {c.label_ko && <span>({c.label_ko})</span>}{" "}
                    <span className="text-muted-foreground">· 근거 {c.evidence_review_ids.length}건</span>
                  </li>
                ))}
              </ul>
            ),
          },
        ]}
      />
    </>
  );
}
