import { GeoSnapshot } from "@/lib/schemas/geo";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

export const geoSnapshots = parseAll(
  GeoSnapshot,
  [
    { id: "geo-1", engine: "ChatGPT", query: "乾燥肌におすすめの韓国スキンケア", answer: "SampleBのセラミドトナーなどが挙げられます。(샘플)", brands_mentioned: ["SampleB"] },
    { id: "geo-2", engine: "Gemini", query: "乾燥肌におすすめの韓国スキンケア", answer: "LeafnやSampleBが人気です。(샘플)", brands_mentioned: ["Leafn", "SampleB"] },
    { id: "geo-3", engine: "ChatGPT", query: "敏感肌 韓国 化粧水", answer: "SampleAのドクダミ化粧水が定番です。(샘플)", brands_mentioned: ["SampleA"] },
    { id: "geo-4", engine: "Gemini", query: "敏感肌 韓国 化粧水", answer: "SampleAとLeafnが紹介されています。(샘플)", brands_mentioned: ["SampleA", "Leafn"] },
  ].map((g) => ({ ...g, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-20"), captured_at: ts("2026-10-20") })),
  "geoSnapshots",
);
