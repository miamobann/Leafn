// 시험 결과 기록과 표 출력 (연습장 전용). 샘플 판정과 비교하고, 토큰 사용량을 실행 간에 비교한다.
import { z } from "zod";
import { AdAction, AdUsage } from "@/lib/schemas/ad-check";
import { JudgedLine } from "./prompt-lab";

const UsageSchema = z.object({ input: z.number(), cached: z.number(), output: z.number() });

export const CallRecord = z.object({
  group: z.string(), // 제품|사용처
  lineCount: z.number(), // 이 그룹의 줄 수
  cachedLines: z.number(), // 캐시에서 재사용한 줄 수 (API 호출 없음)
  sentLines: z.number(), // 실제로 요청에 넣은 줄 수
  usage: UsageSchema,
  attempts: z.number(),
  ms: z.number(),
  error: z.string().nullable(),
});
export type CallRecord = z.infer<typeof CallRecord>;

export const LineRecord = z.object({
  sample_id: z.string(),
  product_id: z.string(),
  usage: AdUsage,
  original: z.string(),
  sample_action: AdAction,
  ai: JudgedLine,
  from_cache: z.boolean(),
});
export type LineRecord = z.infer<typeof LineRecord>;

export const RunRecord = z.object({
  version: z.string(),
  model: z.string(),
  started_at: z.string(),
  system_chars: z.number(),
  calls: z.array(CallRecord),
  lines: z.array(LineRecord),
  warnings: z.array(z.string()),
});
export type RunRecord = z.infer<typeof RunRecord>;

type Totals = { input: number; cached: number; output: number; apiCalls: number };

function totalsOf(run: RunRecord): Totals {
  return run.calls.reduce<Totals>(
    (sum, c) => ({
      input: sum.input + c.usage.input,
      cached: sum.cached + c.usage.cached,
      output: sum.output + c.usage.output,
      apiCalls: sum.apiCalls + (c.sentLines > 0 ? 1 : 0),
    }),
    { input: 0, cached: 0, output: 0, apiCalls: 0 },
  );
}

/** 1M 토큰당 가격(달러)을 환경 변수로 받으면 비용을 추정한다. 없으면 null */
function estimateCost(t: Totals): number | null {
  const pIn = Number(process.env.LAB_PRICE_IN);
  const pOut = Number(process.env.LAB_PRICE_OUT);
  if (!Number.isFinite(pIn) || !Number.isFinite(pOut) || !process.env.LAB_PRICE_IN || !process.env.LAB_PRICE_OUT) return null;
  const pCachedRaw = Number(process.env.LAB_PRICE_CACHED);
  const pCached = process.env.LAB_PRICE_CACHED && Number.isFinite(pCachedRaw) ? pCachedRaw : pIn;
  return ((t.input - t.cached) * pIn + t.cached * pCached + t.output * pOut) / 1_000_000;
}

const BASIS_ITEM = /(F\d+(\.\d+)?|E\d+|〔表3〕|薬機法|景品表示法|特定商取引法|스테마)/;

function basisProblem(basis: string): boolean {
  if (basis === "자료 확인 필요") return false;
  return !basis.split(";").every((part) => BASIS_ITEM.test(part));
}

const fmt = (n: number) => n.toLocaleString("en-US");

export function formatRun(run: RunRecord): string {
  const out: string[] = [];
  const t = totalsOf(run);
  out.push(`■ 실행: 프롬프트 ${run.version} · 모델 ${run.model} · system ${fmt(run.system_chars)}자`);

  out.push("\n[호출별 토큰]");
  out.push("그룹(제품|사용처)                | 줄(재사용/요청) | 입력(캐시) | 출력 | 시도 | 시간");
  for (const c of run.calls) {
    const tokens = c.sentLines > 0 ? `${fmt(c.usage.input)}(${fmt(c.usage.cached)})` : "-";
    out.push(
      `${c.group.padEnd(30)} | ${c.lineCount}줄 (${c.cachedLines}/${c.sentLines}) | ${tokens} | ${c.sentLines > 0 ? fmt(c.usage.output) : "-"} | ${c.attempts} | ${(c.ms / 1000).toFixed(1)}s${c.error ? ` · 오류: ${c.error}` : ""}`,
    );
  }
  const cost = estimateCost(t);
  out.push(
    `합계: API 호출 ${t.apiCalls}회 · 입력 ${fmt(t.input)} (캐시 ${fmt(t.cached)}) · 출력 ${fmt(t.output)}${cost === null ? "" : ` · 추정 $${cost.toFixed(3)}`}`,
  );

  out.push("\n[줄별 판정: 샘플 vs AI]");
  out.push("문구   | 샘플        | AI          | 일치 | findings | 대체표현 | 비고");
  let matched = 0;
  for (const l of run.lines) {
    const same = l.sample_action === l.ai.action;
    if (same) matched += 1;
    const noPos = l.ai.findings.filter((f) => f.start === undefined).length;
    const badBasis = l.ai.findings.filter((f) => basisProblem(f.basis)).length;
    const unknown = l.ai.findings.filter((f) => f.basis === "자료 확인 필요").length;
    const suggestions = l.ai.findings.reduce((n, f) => n + f.suggestions.length, 0);
    const notes = [
      l.from_cache ? "캐시" : "",
      noPos ? `위치 못 찾음 ${noPos}` : "",
      badBasis ? `근거 형식 이상 ${badBasis}` : "",
      unknown ? `자료 확인 필요 ${unknown}` : "",
    ].filter(Boolean);
    out.push(`${l.sample_id.padEnd(6)} | ${l.sample_action.padEnd(11)} | ${l.ai.action.padEnd(11)} | ${same ? "○" : "×"}    | ${l.ai.findings.length}        | ${suggestions}        | ${notes.join(", ")}`);
  }
  out.push(`행동 기준 일치: ${matched}/${run.lines.length} (샘플은 정답이 아니라 가설이다)`);

  if (run.warnings.length > 0) out.push(`\n[경고]\n${run.warnings.map((w) => `- ${w}`).join("\n")}`);
  return out.join("\n");
}

/** 같은 문구들을 두 번 돌린 결과 비교 (예: v1 기준선 vs v2). a 가 기준 */
export function formatComparison(a: RunRecord, b: RunRecord): string {
  const out: string[] = [];
  const ta = totalsOf(a);
  const tb = totalsOf(b);
  const pct = (x: number, y: number) => (x === 0 ? "-" : `${(((y - x) / x) * 100).toFixed(0)}%`);
  out.push(`■ 비교: A = ${a.version}/${a.model} → B = ${b.version}/${b.model}`);
  out.push("항목        |        A |        B | 변화");
  out.push(`API 호출    | ${String(ta.apiCalls).padStart(8)} | ${String(tb.apiCalls).padStart(8)} | ${pct(ta.apiCalls, tb.apiCalls)}`);
  out.push(`입력 토큰   | ${fmt(ta.input).padStart(8)} | ${fmt(tb.input).padStart(8)} | ${pct(ta.input, tb.input)}`);
  out.push(`  캐시됨    | ${fmt(ta.cached).padStart(8)} | ${fmt(tb.cached).padStart(8)} |`);
  out.push(`출력 토큰   | ${fmt(ta.output).padStart(8)} | ${fmt(tb.output).padStart(8)} | ${pct(ta.output, tb.output)}`);

  const byId = new Map(b.lines.map((l) => [l.sample_id, l]));
  const diffs = a.lines.flatMap((l) => {
    const other = byId.get(l.sample_id);
    return other && other.ai.action !== l.ai.action ? [`${l.sample_id}: ${l.ai.action} → ${other.ai.action} (샘플 ${l.sample_action})`] : [];
  });
  out.push(diffs.length === 0 ? "\n판정(action)이 달라진 줄: 없음" : `\n판정(action)이 달라진 줄 ${diffs.length}개\n${diffs.map((d) => `- ${d}`).join("\n")}`);
  out.push("※ 입력 토큰은 같은 문구 집합끼리만 비교한다. 줄 수가 다르면 의미가 없다.");
  return out.join("\n");
}
