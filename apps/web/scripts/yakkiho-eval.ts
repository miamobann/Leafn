// 약기법 판정 미니 시험 (터미널). 가이드라인이 직접 든 「표현할 수 없는 / 표현할 수 있는」 예문 20개를 서비스와 같은 판정 함수(judgeLines)에 넣고 채점한다.
// 정답 출처: knowledge/yakkiho/01·02·03 (化粧品等の適正広告ガイドライン 예문). 이 예문은 판정 프롬프트의 기준 자료에도 들어 있어 "교과서 시험"이다 (실제 정확도보다 높게 나올 수 있다).
// 실행 (apps/web 에서, .env.local 의 OPENAI_API_KEY 사용. AI 호출 1번):
//   npx tsx --env-file=.env.local scripts/yakkiho-eval.ts
import { judgeLines } from "@/lib/ai/ad-check/judge";

type Case = { text: string; expect: "ng" | "ok"; source: string };

const CASES: Case[] = [
  { text: "小ジワを目立たなくする。", expect: "ng", source: "01 効能の範囲 ×" },
  { text: "シミ、ソバカスを防ぐ。", expect: "ng", source: "01 効能の範囲 ×" },
  { text: "使えば使うほど肌が白くなるホワイトニング効果", expect: "ng", source: "03 E15 美白 認められない" },
  { text: "美白パウダーでシミ、ソバカスが消えてなくなる", expect: "ng", source: "03 E15.2 認められない" },
  { text: "若々しい素肌がよみがえるエイジングケア", expect: "ng", source: "03 エイジングケア 認められない" },
  { text: "シワを改善するエイジングケア", expect: "ng", source: "03 エイジングケア 認められない" },
  { text: "幹細胞コスメ", expect: "ng", source: "03 細胞 認められない" },
  { text: "肌が明るくなったのでビックリしました。", expect: "ng", source: "03 体験談 認められない" },
  { text: "こんなにハリがでるなんて。", expect: "ng", source: "03 体験談 認められない" },
  { text: "赤ちゃんにも安心", expect: "ng", source: "02 安全性の保証 認められない" },
  { text: "乾燥による小ジワを目立たなくする。", expect: "ok", source: "01 効能の範囲 ○" },
  { text: "日焼けによるシミ、ソバカスを防ぐ。", expect: "ok", source: "01 効能の範囲 ○" },
  { text: "角質層のすみずみへ", expect: "ok", source: "03 浸透 表現できる" },
  { text: "乾燥肌用", expect: "ok", source: "03 専用 表現できる" },
  { text: "皮膚の乾燥を防いで小ジワを目立たなくします", expect: "ok", source: "03 小ジワ 認められる" },
  { text: "年を重ねた肌にうるおいを与えるエイジングケア", expect: "ok", source: "03 エイジングケア 認められる" },
  { text: "しっとりした使い心地が私の好みに合っています。", expect: "ok", source: "03 体験談 認められる" },
  { text: "さっぱりとした感触が私にピッタリです。", expect: "ok", source: "03 体験談 認められる" },
  { text: "使いやすいので忙しい私にピッタリ、助かっています。", expect: "ok", source: "03 体験談 認められる" },
  { text: "うるおい効果が小ジワを目立たなくします", expect: "ok", source: "03 小ジワ 認められる" },
];

const LABEL = { must_fix: "고쳐야 함", expert: "전문가 확인", should_fix: "수정 권장", ok: "문제 없음" } as const;

async function main() {
  const result = await judgeLines({
    product: { name: "시험용 토너", product_category: "general_cosmetic", ingredients: ["水", "グリセリン", "BG", "ヒアルロン酸Na"] },
    usage: "detail_page",
    lines: CASES.map((c) => c.text),
  });

  let caught = 0; // 위반 예문을 걸러냄
  let overBlocked = 0; // 허용 예문을 「고쳐야 함」·「전문가 확인」으로 막음
  let cautious = 0; // 허용 예문을 「수정 권장」 (근거 자료 요구 등 보수적 판정)
  CASES.forEach((c, i) => {
    const action = result.lines[i]!.action;
    const mark =
      c.expect === "ng" ? (action !== "ok" ? "✅" : "❌ 놓침") : action === "ok" ? "✅" : action === "should_fix" ? "⚠️ 보수적" : "❌ 과잉";
    if (c.expect === "ng" && action !== "ok") caught += 1;
    if (c.expect === "ok" && (action === "must_fix" || action === "expert")) overBlocked += 1;
    if (c.expect === "ok" && action === "should_fix") cautious += 1;
    console.log(`${String(i + 1).padStart(2)}. [정답 ${c.expect === "ng" ? "걸려야 함" : "문제 없음"}] ${LABEL[action]} ${mark}  ${c.text}  (${c.source})`);
  });

  const ng = CASES.filter((c) => c.expect === "ng").length;
  const ok = CASES.length - ng;
  console.log("\n── 결과 ──");
  console.log(`위반 탐지율: ${caught}/${ng} (${Math.round((caught / ng) * 100)}%)`);
  console.log(`허용 표현 통과: ${ok - overBlocked - cautious}/${ok} · 보수적(수정 권장) ${cautious} · 과잉 판정 ${overBlocked}`);
  console.log(`모델: ${result.model} · 프롬프트: ad-check.${result.promptVersion} · 시도 ${result.attempts}번`);
  if (result.warnings.length) console.log(`참고: ${result.warnings.join(" / ")}`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? `${e.message}${e.cause instanceof Error ? ` | cause: ${e.cause.message}` : ""}` : e);
  process.exit(1);
});
