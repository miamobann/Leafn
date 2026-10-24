// 리뷰 CSV의 열 연결 · 검증. 우리 제품 리뷰(own-review-import.tsx)와 경쟁 제품 CSV(csv-import.tsx)가 함께 쓴다.
// 파일은 브라우저에서만 읽는다. 저장은 우리 제품 쪽만 한다 (lib/data/review-import-actions.ts).
import Papa from "papaparse";
import type { z } from "zod";
import { ReviewCsvRow } from "@/lib/schemas/review";

// aliases: 올리브영 · 자사몰 관리자 화면이나 외부에서 받은 CSV의 열 이름 후보 (소문자로 비교)
export const FIELDS = [
  { key: "rating", label: "평점", required: true, aliases: ["평점", "별점", "評価", "評点", "rating"] },
  { key: "body", label: "본문", required: true, aliases: ["본문", "리뷰내용", "리뷰 내용", "내용", "本文", "口コミ", "レビュー", "review", "comment"] },
  { key: "posted_date", label: "작성일", required: true, aliases: ["작성일", "작성일자", "등록일", "投稿日", "日付", "date"] },
  { key: "skin_type", label: "피부타입", required: false, aliases: ["피부타입", "피부 타입", "肌質", "肌タイプ", "skin_type"] },
  { key: "age_group", label: "연령대", required: false, aliases: ["연령대", "나이", "年代", "年齢", "age"] },
] as const;
export type FieldKey = (typeof FIELDS)[number]["key"];
export type Mapping = Record<FieldKey, string>; // 값은 CSV 열 이름, ""는 연결 안 함

/** 리뷰 번호 열. 화면에서 고르지 않고 이름이 맞으면 저장할 때 external_id로 쓴다 */
const REVIEW_NO_ALIASES = ["리뷰번호", "리뷰 번호", "review_id", "review_no"];

// 제품은 화면에서 고르므로 CSV 한 줄에는 상품명이 없다
export const RowSchema = ReviewCsvRow.omit({ product_name: true });
export type Row = z.infer<typeof RowSchema>;

export type Parsed = { fileName: string; headers: string[]; rows: Record<string, string>[] };
export type CheckedRow =
  | { line: number; ok: true; data: Row; reviewNo: string; source: Record<string, string> }
  | { line: number; ok: false; raw: Record<FieldKey, string>; issues: string[] };

export function autoMapping(headers: string[]): Mapping {
  const pick = (aliases: readonly string[]) => headers.find((h) => aliases.includes(h.toLowerCase())) ?? "";
  return Object.fromEntries(FIELDS.map((f) => [f.key, pick(f.aliases)])) as Mapping;
}

export function missingFields(mapping: Mapping) {
  return FIELDS.filter((f) => f.required && !mapping[f.key]);
}

/** CSV 파일을 읽는다. 첫 줄은 열 이름. 엑셀에서 저장한 CSV는 첫 열 이름 앞에 BOM이 붙어서 뗀다 */
export function readCsv(file: File, onDone: (result: { ok: true; parsed: Parsed } | { ok: false; message: string }) => void) {
  Papa.parse<Record<string, string>>(file, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.replace(/^﻿/, "").trim(),
    complete: (result) => {
      if (result.data.length === 0) onDone({ ok: false, message: "CSV에 데이터 행이 없어요" });
      else onDone({ ok: true, parsed: { fileName: file.name, headers: result.meta.fields ?? [], rows: result.data } });
    },
    error: (err) => onDone({ ok: false, message: `CSV를 읽지 못했어요: ${err.message}` }),
  });
}

/** 열 연결대로 한 줄씩 검증한다. 필수 열이 하나라도 비면 빈 배열 */
export function checkRows(parsed: Parsed, mapping: Mapping): CheckedRow[] {
  if (missingFields(mapping).length > 0) return [];
  const noColumn = parsed.headers.find((h) => REVIEW_NO_ALIASES.includes(h.toLowerCase()));
  return parsed.rows.map((row, i) => {
    const raw = Object.fromEntries(FIELDS.map((f) => [f.key, mapping[f.key] ? (row[mapping[f.key]] ?? "") : ""])) as Record<FieldKey, string>;
    const line = i + 2; // 1번 줄은 열 이름
    const blank = FIELDS.filter((f) => f.required && !raw[f.key].trim());
    if (blank.length > 0) return { line, ok: false, raw, issues: blank.map((f) => `${f.label}이 비어 있어요`) };
    const result = RowSchema.safeParse({ ...raw, skin_type: raw.skin_type || undefined, age_group: raw.age_group || undefined });
    if (!result.success) return { line, ok: false, raw, issues: result.error.issues.map((x) => x.message) };
    return { line, ok: true, data: result.data, reviewNo: noColumn ? (row[noColumn] ?? "").trim() : "", source: row };
  });
}
