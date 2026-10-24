// 광고 검토 탭의 안내 문구 (CLAUDE.md 7장 6번). 공용 AiDisclaimer는 화면 위에 고정(sticky)되어
// 긴 결과 화면에서 계속 따라와 읽기 어려워서, 탭 안에서는 고정하지 않는 한 줄 안내로 보여 준다. 문구는 같다.
export const AD_DISCLAIMER_TEXT = "법률 자문이 아닌 검토 보조 결과이며 최종 판단은 담당자·전문가가 합니다.";

export function AdDisclaimer() {
  return (
    <p className="rounded-md border px-3 py-2 text-xs text-muted-foreground">
      {AD_DISCLAIMER_TEXT}
    </p>
  );
}
