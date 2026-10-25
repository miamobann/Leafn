import { redirect } from "next/navigation";

// 시장 분석은 원페이지(/market)로 합쳤다 (2026-10-24 팀 결정). 예전 주소는 해당 섹션으로 보낸다
export default function MarketTrendsPage() {
  redirect("/market#supply");
}
