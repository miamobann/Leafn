import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatDate } from "@/lib/format";

/** CLAUDE.md 7장 5번. 결과 상단에 고정한다. */
export function AiDisclaimer() {
  return (
    <Alert className="sticky top-0 z-10 bg-background">
      <AlertDescription>
        법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 합니다.
      </AlertDescription>
    </Alert>
  );
}

/** AI 결과의 모델·프롬프트 버전·생성 시각 (CLAUDE.md 5장 규칙) */
export function AiResultMeta({ model, promptVersion, createdAt }: { model: string; promptVersion: string; createdAt: string }) {
  return (
    <p className="text-xs text-muted-foreground">
      {model} · {promptVersion} · {formatDate(createdAt)}
    </p>
  );
}
