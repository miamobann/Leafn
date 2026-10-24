import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// Execute the actual TypeScript adapters without introducing a test dependency.
function load(relative, overrides = {}) {
  const filename = path.resolve(root, relative);
  const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const loaded = { exports: {} };
  const localRequire = (name) => {
    if (Object.hasOwn(overrides, name)) return overrides[name];
    if (name.startsWith('@/')) return load(`${name.slice(2)}.ts`, overrides);
    if (name.startsWith('.')) return load(path.relative(root, path.resolve(path.dirname(filename), `${name}.ts`)), overrides);
    return nativeRequire(name);
  };
  new Function('require', 'module', 'exports', source)(localRequire, loaded, loaded.exports);
  return loaded.exports;
}
const { productFromRow, reviewFromRow, analysisFromRow, summarizeReviews } = load('lib/data/row-adapters.ts');
const base = { id: 'real-product', workspace_id: 'team-a', created_at: '2026-10-24T00:00:00Z' };
test('DB platform_id and nullable fields map without sample IDs', () => {
  const row = productFromRow({ ...base, platform_id: 'qoo10', kind: 'own', brand: 'Brand', name: 'Name',
    category: null, url: null, price_jpy: null, volume_ml: null, ingredients: [], features: [], image_path: null, source_raw: null });
  assert.equal(row.id, 'real-product');
  assert.equal(row.platform, 'qoo10');
  assert.equal(row.category, undefined);
  assert.equal(row.project_id, null);
  assert.throws(() => productFromRow({ ...row, platform_id: 'unsupported' }));
});
test('nullable review fields and analysis topics are accepted', () => {
  const row = reviewFromRow({ ...base, product_id: 'real-product', source: 'qoo10', external_id: 'source-1',
    lang: 'ja', rating: 2, body: 'text', posted_at: null, body_ko: null, reviewer_attrs: null, raw: null });
  assert.equal(row.posted_at, base.created_at);
  assert.equal(row.body_ko, undefined);
  const analysis = analysisFromRow({ ...base, review_id: row.id, sentiment: 'negative', keywords: [],
    pain_points: ['sticky', 'sticky'], repurchase_factors: [], topics: null, model: 'test', prompt_version: 'test' });
  const report = summarizeReviews([{ ...row, analysis }, { ...row, id: 'unanalysed', analysis: null }]);
  assert.deepEqual(report.sentiment, { positive: 0, negative: 1, neutral: 0 });
  assert.equal(report.insights[0].count, 1);
  assert.deepEqual(report.insights[0].evidence_review_ids, [row.id]);
});
test('workspace filter and stable pagination are applied to every page; errors do not become samples', async () => {
  const calls = [];
  let error = false;
  const client = { from(table) {
    const query = {
      select() { return query; },
      eq(key, value) { calls.push([table, key, value]); return query; },
      order(key) { assert.equal(key, 'id'); return query; },
      async range(start, end) {
        assert.equal(end - start, 999);
        if (error) return { data: null, error: { message: 'permission denied' } };
        return { data: Array.from({ length: start === 0 ? 1000 : 1 }, (_, i) => ({ id: start + i })), error: null };
      },
    };
    return query;
  } };
  const { readRows } = load('lib/data/db.ts', {
    react: { cache: (fn) => fn },
    '@/lib/supabase/server': { createClient: async () => client },
    './workspace': { isSupabaseConfigured: () => true, getMyWorkspace: async () => ({ workspace: { id: 'team-a' } }) },
  });
  assert.equal((await readRows('products')).length, 1001);
  assert.deepEqual(calls, [['products', 'workspace_id', 'team-a'], ['products', 'workspace_id', 'team-a']]);
  error = true;
  await assert.rejects(readRows('products'), /permission denied/);
});
test('configured DB without membership never falls back to samples', async () => {
  const { readRows } = load('lib/data/db.ts', {
    react: { cache: (fn) => fn },
    '@/lib/supabase/server': { createClient: async () => { throw new Error('must not query'); } },
    './workspace': { isSupabaseConfigured: () => true, getMyWorkspace: async () => null },
  });
  await assert.rejects(readRows('products'), /워크스페이스/);
});

export { load };

test('review update rejects non-owners and missing records, and confirms one persisted row', async () => {
  let role = 'member', row = null, configured = true;
  const filters = [];
  const query = { update() { return query; }, eq(k, v) { filters.push([k, v]); return query; },
    select() { return query; }, async maybeSingle() { return { data: row, error: null }; } };
  const { PATCH } = load('app/api/ad-check/[checkId]/route.ts', {
    '@/lib/data/workspace': { isSupabaseConfigured: () => configured, getCurrentUser: async () => ({ id: 'user' }),
      getMyWorkspace: async () => ({ role, workspace: { id: 'team-a' } }) },
    '@/lib/supabase/server': { createClient: async () => ({ from: () => query }) },
  });
  const request = () => new Request('http://localhost', { method: 'PATCH', body: JSON.stringify({ review_status: 'approved', is_expert_review_requested: false, reviewer_note: null }) });
  const params = { params: Promise.resolve({ checkId: '22222222-2222-4222-8222-222222222222' }) };
  assert.equal((await PATCH(request(), params)).status, 403);
  role = 'owner';
  assert.equal((await PATCH(request(), params)).status, 404);
  row = { id: 'saved' };
  assert.equal((await PATCH(request(), params)).status, 200);
  assert.ok(filters.some(([k, v]) => k === 'workspace_id' && v === 'team-a'));
  configured = false;
  assert.equal((await PATCH(request(), params)).status, 409);
});

test('ad generation refuses missing membership before AI and reports insert failure', async () => {
  let mine = null, aiCalls = 0;
  const { POST } = load('app/api/ad-check/route.ts', {
    '@/lib/data/workspace': { isSupabaseConfigured: () => true, getMyWorkspace: async () => mine },
    '@/lib/supabase/server': { createClient: async () => ({ auth: { getUser: async () => ({ data: { user: {} } }) },
      from: () => ({ insert: async () => ({ error: { code: 'PGRST205' } }) }) }) },
    '@/lib/schemas/ad-check-ai': { AdCheckRequest: { safeParse: () => ({ success: true, data: { text: 'text', product: {}, usage: 'sns' } }) } },
    '@/lib/ai/ad-check/input': { splitInputLines: () => ['text'] },
    '@/lib/ai/ad-check/judge': { judgeLines: async () => { aiCalls++; return { lines: [], model: 'test', promptVersion: 'test' }; } },
    '@/lib/ai/ad-check/to-ad-check': { toAdCheck: () => ({ id: 'test', line_results: [] }) },
    '@/lib/ai/client': { AiCallError: class extends Error {} },
    '@/lib/ai/config': { AiConfigError: class extends Error {} },
  });
  const request = () => new Request('http://localhost', { method: 'POST', body: '{}' });
  assert.equal((await POST(request())).status, 403);
  assert.equal(aiCalls, 0);
  mine = { workspace: { id: 'team-a' } };
  assert.equal((await POST(request())).status, 500);
});
