// 전문가 확인 자료 (실무자 비판 8번, 2026-10-25): 일본 대리점·약사 컨설턴트에게 메일로 보낼 확인 요청서.
// 저장된 검토 결과만으로 만든다 (AI를 다시 부르지 않는다). 받는 사람이 일본인이라 제목·항목은 일본어, 담당자 확인용으로 한국어를 덧붙인다.
import type { z } from "zod";
import type { AdAction, AdCheck, AdUsage, ProductCategory } from "@/lib/schemas/ad-check";

const USAGE_JA: Record<z.infer<typeof AdUsage>, string> = {
  detail_page: "商品詳細ページ",
  sns: "SNS投稿",
  banner: "広告バナー",
  survey_result: "診断結果ページ",
  notify_button: "通知ボタン",
};
const CATEGORY_JA: Record<z.infer<typeof ProductCategory>, string> = { general_cosmetic: "一般化粧品", quasi_drug: "医薬部外品" };
const ACTION_JA: Record<AdAction, string> = { must_fix: "修正必須", should_fix: "修正推奨", expert: "専門家確認", ok: "問題なし" };

export const EXPERT_REQUEST_JA = "以下の広告表現について、薬機法および「化粧品等の適正広告ガイドライン」の観点からご確認をお願いいたします。";
export const EXPERT_REQUEST_KO = "아래 광고 표현을 약기법 및 「화장품 등의 적정광고 가이드라인」 관점에서 확인 부탁드립니다.";
export const EXPERT_NOTE_JA = "※ 社内のAI検討補助ツールによる一次判定です。法的判断ではありません。";

export type ExpertItem = {
  index: number;
  action: AdAction;
  actionJa: string;
  /** 일본어 문구 (일본어 입력이면 원문, 한국어 입력이면 번역) */
  textJa: string;
  textKo: string | null;
  points: { text: string; reason: string; basis: string; alternatives: { ja: string; ko: string | null }[] }[];
};

export type ExpertSheet = {
  productName: string;
  usageJa: string | null;
  categoryJa: string | null;
  items: ExpertItem[];
};

/** 확인이 필요한 줄(문제없음 제외)만 모은다. 전문가 확인 줄을 맨 앞에 */
export function buildExpertSheet(check: AdCheck, productName: string): ExpertSheet {
  const order: Record<AdAction, number> = { expert: 0, must_fix: 1, should_fix: 2, ok: 3 };
  const items = (check.line_results ?? [])
    .filter((l) => l.action !== "ok")
    .toSorted((a, b) => order[a.action] - order[b.action] || a.line_index - b.line_index)
    .map((l) => {
      const isJa = /[぀-ヿ]/.test(l.original);
      return {
        index: l.line_index,
        action: l.action,
        actionJa: ACTION_JA[l.action],
        textJa: isJa ? l.original : (l.translated_text ?? l.original),
        textKo: isJa ? l.back_translation_ko : l.original,
        points: check.findings
          .filter((f) => f.line_index === l.line_index)
          .map((f) => ({
            text: f.text,
            reason: f.reason,
            basis: f.basis,
            alternatives: (f.suggestion_rechecks ?? []).filter((r) => r.recheck === "pass").map((r) => ({ ja: r.text, ko: r.text_ko })),
          })),
      };
    });
  return {
    productName,
    usageJa: check.usage ? USAGE_JA[check.usage] : null,
    categoryJa: check.product_category ? CATEGORY_JA[check.product_category] : null,
    items,
  };
}

/** 메일 본문에 붙여 넣을 글 */
export function expertSheetText(sheet: ExpertSheet, team: string, date: string): string {
  const head = [
    "【薬機法 広告表現 確認依頼】",
    `依頼元: ${team} / 日付: ${date}`,
    `製品: ${sheet.productName}${sheet.categoryJa ? `（${sheet.categoryJa}）` : ""}${sheet.usageJa ? ` / 用途: ${sheet.usageJa}` : ""}`,
    "",
    EXPERT_REQUEST_JA,
    `(${EXPERT_REQUEST_KO})`,
  ];
  const body = sheet.items.flatMap((it, i) => [
    "",
    `■ ${i + 1}. [${it.actionJa}] ${it.textJa}`,
    ...(it.textKo ? [`  (韓国語: ${it.textKo})`] : []),
    ...it.points.flatMap((p) => [
      `  ・指摘表現: 「${p.text}」`,
      `    理由(韓国語): ${p.reason}`,
      `    根拠: ${p.basis}`,
      ...(p.alternatives.length ? [`    代替案: ${p.alternatives.map((a) => a.ja).join(" / ")}`] : []),
    ]),
  ]);
  return [...head, ...body, "", EXPERT_NOTE_JA].join("\n");
}
