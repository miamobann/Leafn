// 상세페이지용 리뷰의 「대체 표현 적용」: 약기법 검토가 짚은 부분이 든 문장을 통째로 대체 표현으로 바꾼다.
// 검토 AI의 대체 표현은 위험 구간만이 아니라 그 문장 전체를 고쳐 쓴 안이라서(prompts/ad-check.v6.md) 문장 단위로 바꾼다.
// 일본어 번역은 바꾼 한국어 문장을 다시 판정(번역 포함)해서 새로 얻는다. 서버와 화면이 같이 쓰는 순수 함수.

const SENTENCE_END = /[.!?。！？…]/;

/** 문장 하나의 범위 [start, end). end는 문장 끝 기호와 그 뒤 공백을 포함하지 않는다 */
function sentenceAt(text: string, index: number): { start: number; end: number } {
  let start = index;
  while (start > 0 && !SENTENCE_END.test(text[start - 1]) && text[start - 1] !== "\n") start -= 1;
  while (start < text.length && /\s/.test(text[start])) start += 1;
  let end = index;
  while (end < text.length && !SENTENCE_END.test(text[end]) && text[end] !== "\n") end += 1;
  while (end < text.length && SENTENCE_END.test(text[end])) end += 1; // 끝 기호 묶음(!!, ?! 등)은 문장에 포함
  return { start, end };
}

/**
 * finding이 가리키는 구간(start/end가 맞으면 그 위치, 아니면 처음 나온 위치)이 든 문장을 replacement로 바꾼다.
 * 구간을 본문에서 찾지 못하면 null.
 */
export function replaceSentence(text: string, found: { text: string; start?: number; end?: number }, replacement: string): string | null {
  const at = found.start !== undefined && found.end !== undefined && text.slice(found.start, found.end) === found.text ? found.start : text.indexOf(found.text);
  if (at < 0 || !found.text) return null;
  const { start, end } = sentenceAt(text, at);
  // 대체 표현에 끝 기호가 없으면 원래 문장의 끝 기호를 이어 붙여, 뒤 문장과 붙어 버리지 않게 한다
  const ending = text.slice(start, end).match(/[.!?。！？…]+$/)?.[0] ?? "";
  const fixed = replacement.trim();
  const middle = SENTENCE_END.test(fixed.at(-1) ?? "") ? fixed : fixed + ending;
  // 검토 AI가 문장 하나가 아니라 리뷰 전체를 고쳐 쓴 안을 주면, 앞뒤에 남은 문장이 대체 표현 안에 또 들어 있다.
  // 대체 표현에 이미 있는 문장은 앞뒤에서 빼서 같은 문장이 두 번 나오지 않게 한다 (공백 · 문장 부호는 무시하고 비교)
  // 문장 수가 원문 이상이면 표현만 조금 바꾼 전체 고쳐 쓰기로 보고 그 안을 그대로 쓴다
  const fixedSentences = splitSentences(middle);
  if (fixedSentences.length > 1 && fixedSentences.length >= splitSentences(text).length) return middle.replace(/\s+/g, " ").trim();
  const inFixed = new Set(fixedSentences.map(sentenceKey));
  const keep = (part: string) =>
    splitSentences(part)
      .filter((x) => !inFixed.has(sentenceKey(x)))
      .join(" ");
  return [keep(text.slice(0, start)), middle, keep(text.slice(end))].join(" ").replace(/\s+/g, " ").trim();
}

/** 문장 끝 기호 · 줄바꿈 기준으로 자른 문장들 (끝 기호 포함, 빈 문장 제외) */
function splitSentences(text: string): string[] {
  return (text.match(/[^.!?。！？…\n]+[.!?。！？…]*|[.!?。！？…]+/g) ?? []).map((x) => x.trim()).filter(Boolean);
}

function sentenceKey(sentence: string): string {
  return sentence.replace(/[\s.!?。！？…,、·]/g, "");
}
