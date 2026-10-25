// 근거 표기를 담당자가 읽을 수 있게: AI가 쓰는 기준 자료 파일 번호 「(03)」을 문서 이름으로 바꾼다 (실무자 비판 10번).
// 판정 결과(저장 값)는 그대로 두고 화면에 보여 줄 때만 바꾼다. 파일 번호는 knowledge/yakkiho/ 의 파일 이름 앞 번호다.
const SOURCE_NAME: Record<string, string> = {
  "01": "적정광고 가이드라인 효능 범위 56항목",
  "02": "적정광고 가이드라인 기본편",
  "03": "적정광고 가이드라인 표현편",
  "04": "법 조문 (薬機法 · 景品表示法 등)",
  "05": "스텔스 마케팅 고시",
};

/** 「E8 치유·회복 표현 (03); F4.1 효능 범위 (01)」 → ["E8 치유·회복 표현 · 적정광고 가이드라인 표현편", "F4.1 효능 범위 · 적정광고 가이드라인 효능 범위 56항목"] */
export function basisItems(basis: string): string[] {
  return basis
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => part.replace(/\s*\((0[1-5])\)\s*$/, (_, no: string) => ` · ${SOURCE_NAME[no]}`));
}
