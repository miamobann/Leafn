import { MAX_LINES } from "./action";

/** 입력 문구를 줄로 나눈다. 줄 안의 공백은 한 칸으로 줄이고, 빈 줄은 버리고, 최대 MAX_LINES줄까지만 쓴다 */
export function splitInputLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter((line) => line.length > 0)
    .slice(0, MAX_LINES);
}
