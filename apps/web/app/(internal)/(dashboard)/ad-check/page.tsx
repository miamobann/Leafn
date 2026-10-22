import { AiDisclaimer } from "@/components/common/ai";
import { RiskBadge } from "@/components/common/badges";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PageHeader } from "@/components/layout/page-header";
import { TextReviewTemplate } from "@/components/templates";
import { getAdCheck } from "@/lib/data";

// 결과 패널 모양을 보여주기 위한 샘플 검토
const SAMPLE_ID = "ac-3";

export default async function AdCheckPage() {
  const sample = await getAdCheck(SAMPLE_ID);

  return (
    <>
      <PageHeader title="새 광고 검토" description="약기법 위험 표현, 사유·근거, 대체 표현" featureId="A" />
      <AiDisclaimer />
      <div className="mt-4">
        <TextReviewTemplate
          input={
            <div className="space-y-3">
              <div className="flex gap-2">
                <Badge variant="outline">한국어</Badge>
                <Badge variant="outline">일본어</Badge>
              </div>
              <Textarea placeholder="광고 문구를 입력하세요" rows={6} disabled />
              <Button disabled>검토하기 (P2에서 연결)</Button>
            </div>
          }
          result={
            sample && (
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-2">
                  전체 위험도 {sample.overall_risk && <RiskBadge risk={sample.overall_risk} />}
                </div>
                <p lang="ja">{sample.translated_text ?? sample.input_text}</p>
                {sample.findings.map((f) => (
                  <div key={f.text} className="rounded-md border p-2">
                    <div className="flex items-center gap-2">
                      <RiskBadge risk={f.risk} />
                      <span lang="ja">{f.text}</span>
                    </div>
                    <p className="mt-1">{f.reason}</p>
                    <p className="text-xs text-muted-foreground">근거: {f.basis}</p>
                    <p className="mt-1" lang="ja">
                      대체: {f.suggestions.join(" / ")}
                    </p>
                  </div>
                ))}
                {sample.localized_note && <p className="text-muted-foreground">현지화 메모: {sample.localized_note}</p>}
              </div>
            )
          }
        />
      </div>
    </>
  );
}
