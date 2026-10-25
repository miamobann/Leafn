// 시장 분석 실데이터 불러오기 (서버 전용). 팀원이 보낸 수집 CSV가 이 PC에 있으면 그것을 랭킹 스냅샷으로 읽는다.
// CSV는 .gitignore(*.csv)라 저장소에 올라가지 않는다. 파일이 없으면(다른 PC·배포 환경) null을 돌려 샘플로 돌아간다.
// DB 연동(trend_snapshots)이 되면 이 파일 대신 DB에서 읽는다
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { parseQoo10RankingCsv } from "@/lib/external/qoo10-ranking-csv";
import { TrendSnapshot } from "@/lib/schemas/trend";
import { WORKSPACE_ID } from "@/lib/mock/helpers";
import { IMPORTED_SNAPSHOT_PREFIX } from "@/lib/market-config";

/** 불러올 수집 파일: [플랫폼, 카테고리, 파일 경로(apps/web 기준)] */
const IMPORTS = [{ source: "qoo10_ranking", category: "化粧水", file: "lib/mock/samples/qoo10-ranking-toner.csv" }] as const;

export function importedSnapshots(): TrendSnapshot[] {
  return IMPORTS.flatMap(({ source, category, file }) => {
    const full = path.join(process.cwd(), file);
    if (!existsSync(full)) return [];
    // 수집 시각이 CSV에 없어 파일 수정 시각을 쓴다
    const capturedAt = statSync(full).mtime.toISOString();
    const ranking = parseQoo10RankingCsv(readFileSync(full, "utf8"));
    if (ranking.length === 0) return [];
    return [
      TrendSnapshot.parse({
        id: `${IMPORTED_SNAPSHOT_PREFIX}${source}:${category}`,
        workspace_id: WORKSPACE_ID,
        created_at: capturedAt,
        source,
        category,
        captured_at: capturedAt,
        data: { ranking, ingredients: [] },
      }),
    ];
  });
}
