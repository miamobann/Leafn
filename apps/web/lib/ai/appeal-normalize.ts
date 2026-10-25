// 성분 이름 사전과 글자 맞춤 (AI 호출 없음, 순수 함수). 검색어 분류·GEO 답변 분석·시장 분석 계산이 같이 쓴다.
// (원래 상세 이미지 분석의 후처리 파일이었고, 이미지 분석은 2026-10-24에 뺐다)

/** 통일 이름 → 이미지·상품명에 나오는 표기. 키는 성분 관심도(market/_lib INGREDIENT_MATCH)와 같은 이름을 쓴다 */
export const INGREDIENT_ALIASES: Record<string, string[]> = {
  "ドクダミエキス": ["ドクダミ"],
  "ツボクサエキス": ["ツボクサ", "CICA", "シカ"],
  "ナイアシンアミド": ["ナイアシンアミド"],
  "ヒアルロン酸": ["ヒアルロン"],
  "セラミド": ["セラミド"],
  "ビタミンC誘導体": ["ビタミンC", "アスコルビ"],
  "パンテノール": ["パンテノール"],
  "トラネキサム酸": ["トラネキサム"],
  "レチノール": ["レチノール"],
  "スクワラン": ["スクワラン"],
  "PDRN": ["PDRN"],
  "コメ発酵液": ["米発酵", "コメ発酵"],
  "PHA": ["PHA"],
  "マイクロニードル": ["ニードル"],
};

/** 전각·반각, 공백, 굽은 따옴표(’) 차이로 대조가 틀리지 않게 맞춘다 */
export function fold(s: string): string {
  return s.normalize("NFKC").replace(/[‘’`´]/g, "'").toUpperCase().replace(/\s+/g, "");
}

/** 사전에 있는 성분이면 통일 이름, 없으면 null (검색 자동완성 분류에도 쓴다) */
export function matchIngredient(text: string): string | null {
  const folded = fold(text);
  for (const [canonical, aliases] of Object.entries(INGREDIENT_ALIASES)) {
    if (aliases.some((a) => folded.includes(fold(a)))) return canonical;
  }
  return null;
}
