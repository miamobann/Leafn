// 한국어 조사 고르기: 앞 글자에 받침이 있는지 보고 "이에요/예요", "으로/로"를 정한다.
// 주제 이름처럼 화면에서 바뀌는 낱말 뒤에 조사를 붙일 때 쓴다 (예: 자극 + 이에요, 순함 + 이에요, 향 + 이에요, 보습 + 이에요).

/** 마지막 글자의 받침 번호. 0 = 받침 없음, 8 = ㄹ 받침, null = 한글이 아님 */
function finalConsonant(word: string): number | null {
  const last = [...word.trim()].pop();
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return null;
  return (code - 0xac00) % 28;
}

/** "자극" → "이에요", "순함" → "이에요", "산뜻한 흡수" → "이에요", "향이 강함" → "이에요", "용기 편리" → "예요" (한글이 아니면 "이에요") */
export function yoOf(word: string): "예요" | "이에요" {
  return finalConsonant(word) === 0 ? "예요" : "이에요";
}

/** "자극" → "으로", "향이 강함" → "으로", "흡수" → "로", "편리" → "로", ㄹ 받침(예: "달")도 "로" */
export function euroOf(word: string): "로" | "으로" {
  const f = finalConsonant(word);
  return f === 0 || f === 8 ? "로" : "으로";
}
