import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/layout/page-header";
import { ReportTemplate } from "@/components/templates";
import { EmptyState } from "@/components/common/states";

export default function ReviewsImportPage() {
  return (
    <>
      <PageHeader title="리뷰 가져오기" description="CSV 업로드 또는 플랫폼 수집" featureId="E" />
      <ReportTemplate
        cards={[
          {
            title: "CSV 업로드",
            content: (
              <div className="space-y-3">
                <Input type="file" accept=".csv" disabled />
                <p className="text-xs text-muted-foreground">컬럼: 상품명, 평점, 본문, 작성일 · 미리보기는 P4에서 연결</p>
              </div>
            ),
          },
          {
            title: "플랫폼 수집",
            content: (
              <div className="space-y-3">
                <Input placeholder="상품 URL" disabled />
                <Button disabled>수집 대상 추가</Button>
              </div>
            ),
          },
          { title: "미리보기", wide: true, content: <EmptyState message="파일을 올리면 미리보기가 보여요" /> },
          {
            title: "분석 진행률",
            wide: true,
            content: (
              <div className="space-y-2">
                <Progress value={0} aria-label="분석 진행률" />
                <p className="text-xs text-muted-foreground">50건 묶음 단위로 분석해요</p>
              </div>
            ),
          },
        ]}
      />
    </>
  );
}
