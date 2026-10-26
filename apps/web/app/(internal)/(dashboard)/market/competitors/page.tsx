import { redirect } from "next/navigation";

// 경쟁제품 비교는 시장 분석의 「경쟁제품」 탭으로 옮겼다 (2026-10-26). 예전 주소(홈 링크 등)는 그 탭으로 보낸다.
// ?compare=자사ID,경쟁ID 는 그대로 넘겨 같은 1:1 비교가 열린다. 제품 상세(/market/competitors/[productId])는 그대로 쓴다
export default async function MarketCompetitorsPage({ searchParams }: { searchParams: Promise<{ compare?: string }> }) {
  const { compare } = await searchParams;
  const ids = (compare ?? "").split(",").map((id) => id.trim()).filter(Boolean);
  redirect(ids.length > 0 ? `/market?compare=${ids.map(encodeURIComponent).join(",")}#competitors` : "/market#competitors");
}
