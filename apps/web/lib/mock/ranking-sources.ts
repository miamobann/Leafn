// 크롤러(데이터팀)가 넘겨줄 랭킹 상품 입력의 더미. 이미지 분석(POST /api/trends/appeal)이 이것을 읽는다.
// 楽天 = 가짜 랭킹 스냅샷의 최신 주 化粧水 상위 10, Qoo10 = ranking-banners.json. 크롤러가 생기면 DB에서 읽도록 바꾼다
import { RankingSourceItem } from "@/lib/schemas/trend";
import { bannerImageUrl, findBanner } from "./appeal-samples";
import { parseAll } from "./helpers";
import { trendSnapshots } from "./trends";

const TOP_N = 10;

const rakutenLatest = trendSnapshots.filter((s) => s.source === "rakuten_ranking" && s.category === "化粧水").at(-1);
const qoo10Latest = trendSnapshots.find((s) => s.source === "qoo10_ranking" && s.category === "化粧水");

export const rankingSources = parseAll(
  RankingSourceItem,
  [rakutenLatest, qoo10Latest].flatMap((snap) =>
    !snap
      ? []
      : snap.data.ranking
      .filter((r) => r.rank <= TOP_N)
      .map((r) => {
        const banner = findBanner(snap.source, r.brand, r.name);
        return {
          rank: r.rank,
          name: r.name,
          brand: r.brand,
          price_jpy: r.price_jpy,
          review_count: r.review_count,
          is_kbeauty: r.is_kbeauty,
          source: snap.source,
          category: snap.category,
          captured_at: snap.captured_at,
          image_urls: banner ? [bannerImageUrl(banner)] : [],
          page_text: `${r.brand} ${r.name}`,
        };
      }),
  ),
  "rankingSources",
);
