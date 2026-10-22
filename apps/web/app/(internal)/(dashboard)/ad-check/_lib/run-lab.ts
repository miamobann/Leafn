// 판정 프롬프트 시험 실행 (연습장 전용). apps/web 에서 실행한다:
//   npx tsx "app/(internal)/(dashboard)/ad-check/_lib/run-lab.ts" --dry
//   OPENAI_API_KEY=... OPENAI_MODEL=gpt-4.1-mini npx tsx ".../run-lab.ts" --version v1
// 옵션: --version v1|v2 (기본 v2) · --model <id> (기본 OPENAI_MODEL 또는 gpt-4.1-mini)
//       --ids A01,A03 (기본: 시험 6개) · --all (A01~A20) · --dry (API 호출 없이 계획만) · --fresh (캐시를 읽지 않음)
//       --compare <기준 run.json> <비교 run.json> (API 호출 없음)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { z } from "zod";
import type { AdUsage } from "@/lib/schemas/ad-check";
import { getLabProducts, getSampleBook } from "./data";
import { cacheDir, cacheKey, readCachedLine, writeCachedLine } from "./lab-cache";
import { formatComparison, formatRun, RunRecord, type CallRecord, type LineRecord } from "./lab-report";
import { MAX_LINES } from "./judge";
import { buildSystemPrompt, judgeRequest, type JudgedLine } from "./prompt-lab";

// 위험·경계·안전이 섞이고 제품·사용처가 다른 6개
const PILOT_IDS = ["A01", "A03", "A07", "A10", "A13", "A18"];

type Options = { version: string; model: string; ids: string[] | "all"; dry: boolean; fresh: boolean; compare: [string, string] | null };

function parseArgs(argv: string[]): Options {
  const opts: Options = { version: "v2", model: process.env.OPENAI_MODEL ?? "gpt-4.1-mini", ids: PILOT_IDS, dry: false, fresh: false, compare: null };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--version") opts.version = argv[(i += 1)] ?? opts.version;
    else if (a === "--model") opts.model = argv[(i += 1)] ?? opts.model;
    else if (a === "--ids") opts.ids = (argv[(i += 1)] ?? "").split(",").filter(Boolean);
    else if (a === "--all") opts.ids = "all";
    else if (a === "--dry") opts.dry = true;
    else if (a === "--fresh") opts.fresh = true;
    else if (a === "--compare") {
      opts.compare = [argv[i + 1] ?? "", argv[i + 2] ?? ""];
      i += 2;
    } else throw new Error(`알 수 없는 옵션: ${a}`);
  }
  return opts;
}

function readRun(file: string): RunRecord {
  return RunRecord.parse(JSON.parse(readFileSync(file, "utf-8")));
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));

  if (opts.compare) {
    console.log(formatComparison(readRun(opts.compare[0]), readRun(opts.compare[1])));
    return;
  }

  const [products, book] = await Promise.all([getLabProducts(), getSampleBook()]);
  const copies = opts.ids === "all" ? book.copies : book.copies.filter((c) => (opts.ids as string[]).includes(c.id));
  if (copies.length === 0) throw new Error("선택된 문구가 없음");

  // 제품·사용처가 같은 문구끼리 한 요청으로 묶는다 (최대 MAX_LINES줄)
  const groups = new Map<string, typeof copies>();
  for (const c of copies) {
    const key = `${c.product_id}|${c.usage}`;
    groups.set(key, [...(groups.get(key) ?? []), c]);
  }

  const system = buildSystemPrompt(opts.version);
  console.log(`프롬프트 ${opts.version}: system ${system.length.toLocaleString("en-US")}자 · 모델 ${opts.model} · 문구 ${copies.length}개 → 요청 그룹 ${groups.size}개${opts.dry ? " (dry: API 호출 안 함)" : ""}`);

  const calls: CallRecord[] = [];
  const lines: LineRecord[] = [];
  const warnings: string[] = [];

  for (const [group, members] of groups) {
    const [productId, usageRaw] = group.split("|");
    const product = products.find((p) => p.id === productId);
    if (!product) throw new Error(`없는 제품: ${productId}`);
    const usage = usageRaw as z.infer<typeof AdUsage>;
    const batch = members.slice(0, MAX_LINES);

    const judged = new Map<string, { line: JudgedLine; fromCache: boolean }>();
    const pending: typeof batch = [];
    for (const c of batch) {
      const key = cacheKey({ line: c.ko, product, usage, version: opts.version, model: opts.model });
      const hit = opts.fresh ? null : readCachedLine(key);
      if (hit) judged.set(c.id, { line: hit, fromCache: true });
      else pending.push(c);
    }

    const record: CallRecord = {
      group,
      lineCount: batch.length,
      cachedLines: batch.length - pending.length,
      sentLines: pending.length,
      usage: { input: 0, cached: 0, output: 0 },
      attempts: 0,
      ms: 0,
      error: null,
    };

    if (pending.length > 0 && !opts.dry) {
      const started = Date.now();
      try {
        const result = await judgeRequest({ model: opts.model, version: opts.version, system, product, usage, lines: pending.map((c) => c.ko) });
        record.usage = result.usage;
        record.attempts = result.attempts;
        warnings.push(...result.warnings.map((w) => `${group}: ${w}`));
        pending.forEach((c, i) => {
          judged.set(c.id, { line: result.lines[i], fromCache: false });
          writeCachedLine(cacheKey({ line: c.ko, product, usage, version: opts.version, model: opts.model }), result.lines[i]);
        });
      } catch (e) {
        // 한 그룹이 실패해도 다른 그룹은 계속한다
        record.error = e instanceof Error ? e.message : String(e);
      }
      record.ms = Date.now() - started;
    }
    calls.push(record);

    for (const c of batch) {
      const hit = judged.get(c.id);
      const sample = book.judgments.find((j) => j.sample_id === c.id);
      if (!hit || !sample) continue;
      lines.push({ sample_id: c.id, product_id: c.product_id, usage: c.usage, original: c.ko, sample_action: sample.action, ai: hit.line, from_cache: hit.fromCache });
    }
  }

  const run: RunRecord = { version: opts.version, model: opts.model, started_at: new Date().toISOString(), system_chars: system.length, calls, lines, warnings };
  console.log(`\n${formatRun(run)}`);

  if (!opts.dry) {
    const dir = path.join(cacheDir(), "runs");
    mkdirSync(dir, { recursive: true });
    const file = path.join(dir, `${run.started_at.replace(/[:.]/g, "-")}_${opts.version}_${opts.model}.json`);
    writeFileSync(file, JSON.stringify(run, null, 2), "utf-8");
    console.log(`\n결과 저장: ${file}\n비교하려면: --compare <기준 파일> <이 파일>`);
  }
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exitCode = 1;
});
