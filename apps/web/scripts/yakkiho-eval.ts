// 약기법 판정 시험 (터미널). 기준 자료(knowledge/yakkiho/01·02·03, 化粧品等の適正広告ガイドライン 改訂α版)가 직접 든 예문 100개를
// 서비스와 같은 판정 함수(judgeLines)에 넣고 채점한다. 정답은 기준 자료 문장 그대로 정했다 (예문 옆에 항목 번호).
// - ng: 기준 자료가 「표현할 수 없다」고 한 것 → 걸려야 정답
// - ok: 기준 자료가 「표현할 수 있다」고 한 것 → 「문제 없음」이면 정답
// - cond: 조건(효능 시험 · 자외선 차단 성분 · 객관적 조사 등)을 갖춘 제품만 쓸 수 있는 것. 시험 제품은 조건 정보가 없으므로 걸러지면 맞는 판단으로 센다
// 한계: 이 예문들은 판정 프롬프트의 기준 자료에도 들어 있어 "교과서 시험"이다 (실제 문구보다 정확도가 높게 나올 수 있다).
// 실행 (apps/web 에서, .env.local 의 OPENAI_API_KEY 사용. AI 호출 10번 안팎):
//   npx tsx --env-file=.env.local scripts/yakkiho-eval.ts          (틀린 줄만 출력)
//   npx tsx --env-file=.env.local scripts/yakkiho-eval.ts --all    (100줄 모두 출력)
import { judgeLines } from "@/lib/ai/ad-check/judge";

type Expect = "ng" | "ok" | "cond";
type Case = { text: string; expect: Expect; source: string };

const ng = (text: string, source: string): Case => ({ text, expect: "ng", source });
const ok = (text: string, source: string): Case => ({ text, expect: "ok", source });
const cond = (text: string, source: string): Case => ({ text, expect: "cond", source });

const CASES: Case[] = [
  // ── 표현할 수 없는 표현 (62) ──
  ng("小ジワを目立たなくする。", "F4.5 しばり 省略"),
  ng("シミ、ソバカスを防ぐ。", "F4.5 しばり 省略"),
  ng("高貴成分配合", "F5.1"),
  ng("デラックス処方", "F5.1"),
  ng("無添加", "F5.8"),
  ng("100％無添加", "F5.9"),
  ng("100％ピュア", "F5.9"),
  ng("肌のトラブルの原因になりがちな香料・着色料を含有していない", "F5.9"),
  ng("美容成分配合", "F5.5-3"),
  ng("美肌成分配合", "F5.5-3"),
  ng("敏感肌専用", "F6.2 / E4"),
  ng("これさえあれば", "F7.0"),
  ng("安全性は確認済み", "F7.0"),
  ng("赤ちゃんにも安心", "F7.0"),
  ng("低刺激", "F7.5 (立証なし)"),
  ng("天然成分を使用しているので安全", "F7.6"),
  ng("天然成分を使用しているので刺激が少ないです", "F7.6"),
  ng("いくら使っても安全", "F7.6"),
  ng("効果大！", "F7.7 (強調)"),
  ng("比類なき安全性", "F8.0"),
  ng("絶対安全", "F8.0"),
  ng("最高の効果", "F8.1"),
  ng("無類の効果", "F8.1"),
  ng("効き目No.1", "F8.2"),
  ng("安全性No.1", "F8.2"),
  ng("一般の洗顔料では落としきれなかったメイクまで。", "F10.1"),
  ng("厚生労働省認可", "F11.5"),
  ng("アレルギーテスト済み", "E2 (デメリット表示なし)"),
  ng("ノンコメド", "E2"),
  ng("肌へ浸透", "E3"),
  ng("子供専用", "E4"),
  ng("女性専用", "E4"),
  ng("ニキビ専用", "E4"),
  ng("強力な保湿", "E5"),
  ng("シワを予防する", "E6"),
  ng("タルミを解消する", "E6"),
  ng("小ジワを解消する", "E7 範囲外"),
  ng("小ジワを予防する", "E7 範囲外"),
  ng("幹細胞コスメ", "E9"),
  ng("細胞由来の力", "E9"),
  ng("黒い肌も徐々に白くするホワイトニング効果", "E15"),
  ng("使えば使うほど肌が白くなるホワイトニング効果", "E15"),
  ng("ホワイトニング効果でシミ、ソバカス残さない", "E15"),
  ng("結果がみえる美白", "E15"),
  ng("美白成分として有効性と安全性を明確に実証", "E15"),
  ng("美白パウダーでシミ、ソバカスが消えてなくなる", "E15.2"),
  ng("若々しい素肌がよみがえるエイジングケア", "E18"),
  ng("肌の老化を防ぐエイジングケア", "E18"),
  ng("アンチエイジングケア", "E18"),
  ng("シワを改善するエイジングケア", "E18"),
  ng("肌細胞に直接働いてシミ、しわ、たるみにエイジングケア", "E18"),
  ng("エイジングケア成分を配合しました", "E18"),
  ng("肌が明るくなったのでビックリしました。", "E20"),
  ng("眼の下の小ジワにうれしい変化が！", "E20"),
  ng("キメが細かくなって、チョット嬉しくなるくらい効果が実感できました。", "E20"),
  ng("こんなにハリがでるなんて。", "E20"),
  ng("満足度93％!!", "E22"),
  ng("愛用者の98％が満足", "E22"),
  ng("抗酸化成分配合", "E24-2"),
  ng("保湿成分 EGF配合", "E24-3"),
  ng("芍薬エキス配合", "E24-4"),
  ng("ヒアルロン酸Na配合", "E24-1 配合目的なし"),
  // ── 표현할 수 있는 표현 (29). 시험 제품(水 · グリセリン · BG · ヒアルロン酸Na)에 사실인 것만 ──
  ok("肌を整える。", "01 (19)"),
  ok("肌のキメを整える。", "01 (20)"),
  ok("皮膚をすこやかに保つ。", "01 (21)"),
  ok("肌荒れを防ぐ。", "01 (22)"),
  ok("肌をひきしめる。", "01 (23)"),
  ok("皮膚にうるおいを与える。", "01 (24)"),
  ok("皮膚の水分、油分を補い保つ。", "01 (25)"),
  ok("皮膚の柔軟性を保つ。", "01 (26)"),
  ok("皮膚を保護する。", "01 (27)"),
  ok("皮膚の乾燥を防ぐ。", "01 (28)"),
  ok("肌を柔らげる。", "01 (29)"),
  ok("肌にはりを与える。", "01 (30)"),
  ok("肌にツヤを与える。", "01 (31)"),
  ok("肌を滑らかにする。", "01 (32)"),
  ok("清涼感を与える", "F4.4 使用感"),
  ok("爽快にする", "F4.4 使用感"),
  ok("無香料・無着色", "F5.9"),
  ok("角質層へ浸透", "E3"),
  ok("角質層のすみずみへ", "E3"),
  ok("敏感肌用", "E4"),
  ok("乾燥肌用", "E4"),
  ok("子供用", "E4"),
  ok("女性向け", "E4"),
  ok("年を重ねた肌にうるおいを与えるエイジングケア", "E18"),
  ok("使用方法が簡単なので不器用な私の味方。", "E20"),
  ok("使いやすいので忙しい私にピッタリ、助かっています。", "E20"),
  ok("しっとりした使い心地が私の好みに合っています。", "E20"),
  ok("さっぱりとした感触が私にピッタリです。", "E20"),
  ok("ヒアルロン酸Na（保湿）配合", "E24 配合目的あり"),
  // ── 조건을 갖춘 제품만 쓸 수 있는 표현 (9) ──
  cond("乾燥による小ジワを目立たなくする。", "01 (56) 注4 効能評価試験"),
  cond("皮膚の乾燥を防いで小ジワを目立たなくします", "E7 注意事項 試験"),
  cond("うるおい効果が小ジワを目立たなくします", "E7 注意事項 試験"),
  cond("キメを整えて乾燥による小ジワを目立たなくします", "E7 注意事項 試験"),
  cond("日やけを防ぐ。", "01 (36) 紫外線防止"),
  cond("日焼けによるシミ、ソバカスを防ぐ。", "01 (37) 紫外線防止"),
  cond("アレルギーテスト済み（全ての方にアレルギーが起こらないということではありません。）", "E2 試験の事実"),
  cond("使いやすさの満足度93％", "E22 客観的調査"),
  cond("売り上げNo.1", "F8.2 客観的調査"),
];

const LABEL = { must_fix: "고쳐야 함", expert: "전문가 확인", should_fix: "수정 권장", ok: "문제 없음" } as const;
const EXPECT_LABEL: Record<Expect, string> = { ng: "걸려야 함", ok: "문제 없음", cond: "조건부" };
/** 한 번에 판정하는 줄 수 (서비스의 콘텐츠 가이드 판정과 같은 이유로 작게 나눈다) */
const CHUNK = 10;
const PRODUCT = { name: "시험용 토너", product_category: "general_cosmetic" as const, ingredients: ["水", "グリセリン", "BG", "ヒアルロン酸Na"] };

async function main() {
  const showAll = process.argv.includes("--all");
  const chunks: Case[][] = [];
  for (let i = 0; i < CASES.length; i += CHUNK) chunks.push(CASES.slice(i, i + CHUNK));
  const results = await Promise.all(chunks.map((c) => judgeLines({ product: PRODUCT, usage: "detail_page", lines: c.map((x) => x.text) })));
  const actions = results.flatMap((r) => r.lines.map((l) => l.action));

  const count = { ngCaught: 0, okPass: 0, okCautious: 0, okOver: 0, condFlagged: 0 };
  CASES.forEach((c, i) => {
    const action = actions[i]!;
    let mark: string;
    if (c.expect === "ng") {
      mark = action !== "ok" ? "✅" : "❌ 놓침";
      if (action !== "ok") count.ngCaught += 1;
    } else if (c.expect === "ok") {
      mark = action === "ok" ? "✅" : action === "should_fix" ? "⚠️ 보수적" : "❌ 과잉";
      if (action === "ok") count.okPass += 1;
      else if (action === "should_fix") count.okCautious += 1;
      else count.okOver += 1;
    } else {
      mark = action !== "ok" ? "✅ 조건 확인 요구" : "⚠️ 조건 없이 통과";
      if (action !== "ok") count.condFlagged += 1;
    }
    if (showAll || !mark.startsWith("✅")) {
      console.log(`${String(i + 1).padStart(3)}. [정답 ${EXPECT_LABEL[c.expect]}] ${LABEL[action]} ${mark}  ${c.text}  (${c.source})`);
    }
  });

  const total = (e: Expect) => CASES.filter((c) => c.expect === e).length;
  const pct = (n: number, d: number) => `${Math.round((n / d) * 100)}%`;
  const nNg = total("ng");
  const nOk = total("ok");
  const nCond = total("cond");
  console.log(`\n── 결과 (${CASES.length}문장) ──`);
  console.log(`위반 탐지율: ${count.ngCaught}/${nNg} (${pct(count.ngCaught, nNg)})`);
  console.log(`허용 표현 그대로 통과: ${count.okPass}/${nOk} (${pct(count.okPass, nOk)}) · 수정 권장 ${count.okCautious} · 과잉 판정 ${count.okOver}`);
  console.log(`조건부 표현에 조건 확인 요구: ${count.condFlagged}/${nCond}`);
  const correct = count.ngCaught + count.okPass + count.condFlagged;
  console.log(`전체 정답률 (수정 권장은 오답으로): ${correct}/${CASES.length} (${pct(correct, CASES.length)})`);
  console.log(`모델: ${results[0]!.model} · 프롬프트: ad-check.${results[0]!.promptVersion} · AI 호출 ${results.reduce((s, r) => s + r.attempts, 0)}번`);
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? `${e.message}${e.cause instanceof Error ? ` | cause: ${e.cause.message}` : ""}` : e);
  process.exit(1);
});
