type PageHeaderProps = {
  title: string;
  description?: string;
  /** 기획안 기능 ID. 테스트·리뷰 때 추적용, 정식 출시 전 제거 */
  featureId?: string;
};

export function PageHeader({ title, description, featureId }: PageHeaderProps) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-semibold">{title}</h1>
        {featureId && (
          <span className="rounded border border-border px-1.5 text-xs text-muted-foreground">{featureId}</span>
        )}
      </div>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
