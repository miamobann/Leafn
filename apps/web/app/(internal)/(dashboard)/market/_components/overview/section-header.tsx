import { FeatureTag, SampleDataBadge } from "@/components/common/badges";

/** 원페이지 섹션 머리말: 이름 + 이 섹션이 답하는 질문 + 샘플 표시 + 데이터 기준 + 기획안 기능 ID */
export function SectionHeader({ titleId, title, question, basis, featureIds = [] }: { titleId?: string; title: string; question: string; basis: string; featureIds?: string[] }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-2 border-b pb-2">
      <div>
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{question}</p>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <SampleDataBadge />
        <span>{basis}</span>
        {featureIds.map((id) => (
          <FeatureTag key={id} id={id} />
        ))}
      </div>
    </div>
  );
}
