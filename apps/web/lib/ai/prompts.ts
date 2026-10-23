// prompts/<name>.v<N>.md 를 읽는다 (프롬프트 원문은 prompts/에만 둔다 · CLAUDE.md 7장)
import { readFile } from "node:fs/promises";
import path from "node:path";

const cache = new Map<string, string>();

export async function loadPrompt(name: string, version: number): Promise<{ text: string; version: string }> {
  const id = `${name}.v${version}`;
  let text = cache.get(id);
  if (text === undefined) {
    text = await readFile(path.join(process.cwd(), "prompts", `${id}.md`), "utf-8");
    cache.set(id, text);
  }
  return { text, version: id };
}
