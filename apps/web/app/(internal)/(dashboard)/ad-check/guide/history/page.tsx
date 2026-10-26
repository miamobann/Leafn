import { redirect } from "next/navigation";

// 「만든 가이드」 목록은 「기록」으로 합쳤다 (2026-10-27 TAB 3). 예전 주소는 기록의 콘텐츠 목록으로 보낸다. 콘텐츠 상세(/ad-check/guide/history/<ID>)는 그대로
export default function GuideHistoryPage() {
  redirect("/ad-check/history?type=content");
}
