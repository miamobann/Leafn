// 판정 결과 재사용 (연습장 전용). 같은 줄·제품·사용처·프롬프트 버전·모델이면 API를 다시 부르지 않는다.
// 저장 위치는 저장소 밖이다 (git status 에 안 뜨고, 실수로 커밋되지 않는다). LAB_CACHE_DIR 로 바꿀 수 있다.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import type { z } from "zod";
import type { AdUsage } from "@/lib/schemas/ad-check";
import { JudgedLine } from "./prompt-lab";
import type { LabProduct } from "./products";

export function cacheDir(): string {
  return process.env.LAB_CACHE_DIR ?? path.join(os.homedir(), ".cache", "leafn-ad-check");
}

/** 제품 정보가 바뀌면 키가 달라지도록 제품 서명을 만든다 */
function productSignature(product: LabProduct): string {
  const ingredients = product.ingredients.map((i) => `${i.ko}/${i.ja}`).join(",");
  return `${product.id}|${product.product_category ?? "미정"}|${ingredients}`;
}

export type CacheKeyInput = {
  line: string;
  product: LabProduct;
  usage: z.infer<typeof AdUsage>;
  version: string;
  model: string;
};

/** (문구 + 제품 + 사용처 + prompt_version + 모델). 모델을 넣는 이유: 모델마다 판정이 달라 섞이면 비교가 틀어진다 */
export function cacheKey({ line, product, usage, version, model }: CacheKeyInput): string {
  const normalized = line.replace(/\s+/g, " ").trim();
  return createHash("sha256")
    .update(JSON.stringify([normalized, productSignature(product), usage, version, model]))
    .digest("hex");
}

function entryPath(key: string): string {
  return path.join(cacheDir(), "lines", `${key}.json`);
}

/** 없거나 모양이 틀리면 null (다시 판정) */
export function readCachedLine(key: string): JudgedLine | null {
  try {
    const parsed = JudgedLine.safeParse(JSON.parse(readFileSync(entryPath(key), "utf-8")));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function writeCachedLine(key: string, judged: JudgedLine): void {
  mkdirSync(path.join(cacheDir(), "lines"), { recursive: true });
  writeFileSync(entryPath(key), JSON.stringify(judged, null, 2), "utf-8");
}
