// 만든 일본어 문구의 금지어 검사 (AI 호출 없음). 프롬프트·판정이 가끔 놓치는 표현을 코드로 확실히 잡는다.
// 근거 자료가 있어야 쓸 수 있는 표현이라 지금은 모두 금지로 본다 (knowledge/content-guide/03).
import type { GuideBodyResult } from "@/lib/schemas/content-guide";

const BANNED: { pattern: RegExp; reason: string }[] = [
  { pattern: /長時間|24時間|ずっと|一日中|持続/, reason: "효과 지속 표현 (근거 필요)" },
  { pattern: /肌にやさし|低刺激|敏感|無刺激|刺激が(少|な)|刺激を感じ|刺激なく/, reason: "저자극 표현 (근거 필요, F7.5)" },
  { pattern: /人気|話題|大人気|売れ|No\.?\s?1|ナンバーワン|1位|累計/, reason: "인기·순위 표현 (근거 필요, F8.2)" },
  { pattern: /治る|治った|改善|再生|美白|シミ|毛穴|ニキビ|肌荒れが/, reason: "의약품적·효능 범위 밖 표현 (E8)" },
  { pattern: /すぐに|即効|\d+日で|翌朝/, reason: "즉효·기간 표현 (F9)" },
  { pattern: /最安値|今だけ|\d+%\s?OFF/, reason: "근거 없는 할인·한정 (景品表示法)" },
];

export type LintHit = { key: string; reason: string; text: string };

/** 블록마다 모든 안을 검사한다 */
export function lintBody(body: GuideBodyResult): LintHit[] {
  return body.blocks.flatMap((b) =>
    b.options.flatMap((o) => BANNED.flatMap(({ pattern, reason }) => {
      const m = o.text_ja.match(pattern);
      return m ? [{ key: b.key, reason, text: m[0] }] : [];
    })),
  );
}
