// 광고 검토 AI 판정 시험 (A01~A20). 실제 화면과 같은 POST /api/ad-check 를 부른다.
// apps/web 에서 `npm run dev` 를 켠 뒤, 다른 터미널에서:
//   node scripts/ad-check-eval/run.mjs --dry      # API 호출 없이 보낼 묶음만 보기
//   node scripts/ad-check-eval/run.mjs            # 시험 (OpenAI 비용이 든다)
// 옵션: --url <주소> (기본 http://localhost:3000) · --ids A01,A13 (일부만)
// 결과 원본은 OS 임시 폴더에 저장한다 (저장소 밖이라 커밋되지 않는다).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_DIR = path.join(HERE, "..", "..", "..", "..", "knowledge", "yakkiho");
const FLAGGED = new Set(["must_fix", "should_fix"]);
const NO_BASIS = "자료 확인 필요";

function parseArgs(argv) {
  const opts = { url: "http://localhost:3000", ids: null, dry: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--url") opts.url = argv[(i += 1)];
    else if (argv[i] === "--ids") opts.ids = new Set(argv[(i += 1)].split(","));
    else if (argv[i] === "--dry") opts.dry = true;
  }
  return opts;
}

/** 같은 제품·사용처 문구를 한 요청으로 묶는다 (한 요청 최대 20줄) */
function groupCases(copies) {
  const groups = new Map();
  for (const c of copies) {
    const key = `${c.product_id}|${c.usage}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(c);
  }
  return [...groups.values()];
}

/** 기준 자료의 항목 번호(E3, F5.5 …)와 본문 전체 */
function loadKnowledge() {
  const files = readdirSync(KNOWLEDGE_DIR).filter((f) => /^0\d-.*\.md$/.test(f));
  const text = files.map((f) => readFileSync(path.join(KNOWLEDGE_DIR, f), "utf-8")).join("\n");
  const codes = new Set([...text.matchAll(/^#{2,3} ([EF]\d+(?:\.\d+)?) /gm)].map((m) => m[1]));
  return { text, codes };
}

/** basis 의 항목 번호가 기준 자료에 실제로 있는지. 없는 번호 목록을 돌려준다 */
function missingBasis(basis, knowledge) {
  if (basis.trim() === NO_BASIS) return [];
  return basis
    .split(";")
    .map((part) => part.trim().split(/\s+/)[0])
    .filter(Boolean)
    .filter((code) => {
      if (/^[EF]\d/.test(code)) return ![...knowledge.codes].some((c) => c === code || c.startsWith(`${code}.`));
      return !knowledge.text.includes(code); // 薬機法 第二条 같은 법령은 본문에 그 말이 있는지만 본다
    });
}

async function judge(url, product, usage, cases) {
  const res = await fetch(`${url}/api/ad-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspace_id: "eval",
      product: { name: product.name, product_category: product.product_category, ingredients: product.ingredients },
      usage,
      text: cases.map((c) => c.ko).join("\n"),
    }),
    redirect: "manual",
  });
  if (res.status >= 300 && res.status < 400) {
    throw new Error("로그인 화면으로 돌려보내졌습니다. .env.local 의 NEXT_PUBLIC_SUPABASE_URL · NEXT_PUBLIC_SUPABASE_ANON_KEY 앞에 # 을 붙이고 npm run dev 를 다시 켜 주세요");
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new Error(`${res.status} ${json?.error ?? "응답을 읽지 못했습니다"}`);
  return json;
}

function grade(c, line, findings, knowledge) {
  const missing = findings.flatMap((f) => missingBasis(f.basis, knowledge).map((code) => `${code}`));
  let result = "참고";
  if (c.intent === "risky") result = FLAGGED.has(line.action) ? "통과" : "놓침";
  if (c.intent === "safe") result = line.action === "must_fix" ? "오탐" : "통과";
  if (missing.length > 0) result = "근거 없음";
  const rechecks = findings.flatMap((f) => f.suggestion_rechecks ?? []);
  return {
    id: c.id,
    intent: c.intent,
    action: line.action,
    result,
    expressions: findings.map((f) => f.text),
    basis: findings.map((f) => f.basis),
    missing,
    rework: rechecks.filter((r) => r.recheck === "needs_rework").length,
    suggestions: rechecks.length,
  };
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const data = JSON.parse(readFileSync(path.join(HERE, "cases.json"), "utf-8"));
  const products = new Map(data.products.map((p) => [p.id, p]));
  const copies = data.copies.filter((c) => !opts.ids || opts.ids.has(c.id));
  const groups = groupCases(copies);

  console.log(`문구 ${copies.length}개 → 요청 ${groups.length}번 (${opts.url})`);
  for (const g of groups) console.log(`  ${products.get(g[0].product_id).name} · ${g[0].usage}: ${g.map((c) => c.id).join(", ")}`);
  if (opts.dry) return;

  const knowledge = loadKnowledge();
  const rows = [];
  const raw = [];
  const total = { input: 0, cached: 0, output: 0 };
  let meta = null;
  for (const g of groups) {
    process.stdout.write(`판정 중: ${g.map((c) => c.id).join(", ")} … `);
    const { check, meta: m } = await judge(opts.url, products.get(g[0].product_id), g[0].usage, g);
    console.log(`완료 (재시도 ${m.attempts - 1}회)`);
    meta = m;
    for (const k of Object.keys(total)) total[k] += m.usage[k];
    raw.push({ ids: g.map((c) => c.id), check, meta: m });
    // 줄 번호는 1부터이고 보낸 순서와 같다 (빈 줄이 없으므로)
    g.forEach((c, i) => {
      const line = check.line_results.find((l) => l.line_index === i + 1);
      if (!line) throw new Error(`${c.id} 의 줄별 결과가 없습니다`);
      rows.push(grade(c, line, check.findings.filter((f) => f.line_index === i + 1), knowledge));
    });
  }

  rows.sort((a, b) => a.id.localeCompare(b.id));
  console.log("");
  console.table(rows.map((r) => ({ ID: r.id, 의도: r.intent, 판정: r.action, 결과: r.result, 위험표현: r.expressions.join(" / ").slice(0, 40), 근거: r.basis.join(" / ").slice(0, 40) })));

  const count = (pred) => rows.filter(pred).length;
  const risky = rows.filter((r) => r.intent === "risky");
  const safe = rows.filter((r) => r.intent === "safe");
  const suggestions = rows.reduce((n, r) => n + r.suggestions, 0);
  console.log(`\n위험 탐지: ${count((r) => r.intent === "risky" && FLAGGED.has(r.action))}/${risky.length} (합격선: 전부)`);
  console.log(`안전 오탐: ${count((r) => r.intent === "safe" && r.action === "must_fix")}/${safe.length} (합격선: 0)`);
  console.log(`근거 날조: ${count((r) => r.missing.length > 0)}건 (합격선: 0)${rows.filter((r) => r.missing.length).map((r) => ` ${r.id}:${r.missing.join(",")}`).join("")}`);
  console.log(`경계 문구: ${rows.filter((r) => r.intent === "borderline").map((r) => `${r.id}=${r.action}`).join(" ")}`);
  console.log(`대체 표현 재수정 필요: ${rows.reduce((n, r) => n + r.rework, 0)}/${suggestions}`);
  console.log(`의도와 다른 문구 (같이 확인): ${rows.filter((r) => ["놓침", "오탐"].includes(r.result)).map((r) => r.id).join(", ") || "없음"}`);
  console.log(`모델 ${meta?.model} · ${meta?.promptVersion} · 토큰 입력 ${total.input.toLocaleString("en-US")}(캐시 ${total.cached.toLocaleString("en-US")}) 출력 ${total.output.toLocaleString("en-US")}`);

  const file = path.join(os.tmpdir(), `ad-check-eval-${meta?.promptVersion ?? "run"}-${Date.now()}.json`);
  writeFileSync(file, JSON.stringify({ rows, raw, total }, null, 2));
  console.log(`\n결과 원본: ${file}`);
}

main().catch((e) => {
  console.error(`\n시험 실패: ${e.message}`);
  process.exitCode = 1;
});
