import { PlatformNote } from "@/lib/schemas/platform";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 강점·고객층은 샘플 문구, 수수료 수치는 공식 자료 확인 전까지 비워 둔다.
// platform 값은 표시 이름 그대로 둔다 (slug는 다른 탭 DB가 나온 뒤 맞춘다, 2026-10-23 결정)
export const platforms = parseAll(
  PlatformNote,
  [
    { id: "pl-qoo10", platform: "Qoo10", strengths: "K-뷰티 인지도, 메가와리 집객 (샘플)", audience: "10~30대 여성 (샘플)", channel_type: "ec", status: "live", memo: "메가와리 참가 신청은 2주 전 마감 (샘플)" },
    { id: "pl-rakuten", platform: "楽天市場", strengths: "포인트 경제권, 폭넓은 연령층 (샘플)", audience: "30~50대 (샘플)", channel_type: "ec", status: "preparing" },
    { id: "pl-amazon", platform: "Amazon.co.jp", strengths: "빠른 배송, 검색 유입 (샘플)", audience: "전 연령 (샘플)", channel_type: "ec", status: "reviewing" },
    { id: "pl-yahoo", platform: "Yahoo!ショッピング", strengths: "PayPay 포인트 연계 (샘플)", audience: "30~50대 (샘플)", channel_type: "ec" },
    { id: "pl-cosme-shopping", platform: "@cosme SHOPPING", strengths: "화장품 전문몰 신뢰도 (샘플)", audience: "화장품 관심층 (샘플)", channel_type: "ec" },
    { id: "pl-cosme", platform: "@cosme", strengths: "리뷰·랭킹 신뢰도 (샘플)", audience: "화장품 관심층 (샘플)", channel_type: "review_sns", status: "reviewing" },
    { id: "pl-lips", platform: "LIPS", strengths: "젊은 층 리뷰 앱 (샘플)", audience: "10~20대 (샘플)", channel_type: "review_sns" },
    { id: "pl-instagram", platform: "Instagram", strengths: "비주얼 중심 신제품 인지 (샘플)", audience: "20~30대 여성 (샘플)", channel_type: "review_sns", status: "live" },
    { id: "pl-x", platform: "X", strengths: "캠페인 확산, 리포스트 (샘플)", audience: "10~30대 (샘플)", channel_type: "review_sns" },
    { id: "pl-tiktok", platform: "TikTok", strengths: "짧은 영상 바이럴 (샘플)", audience: "10~20대 (샘플)", channel_type: "review_sns" },
    { id: "pl-line", platform: "LINE", strengths: "쿠폰·재구매 알림 (샘플)", audience: "전 연령 (샘플)", channel_type: "review_sns" },
    { id: "pl-loft", platform: "버라이어티숍 (ロフト·PLAZA)", strengths: "오프라인 체험 (샘플)", audience: "10~20대 (샘플)", channel_type: "offline", status: "reviewing" },
  ].map((p) => ({ fees_note: null, updated_by: "u-1", memo: null, ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-12") })),
  "platforms",
);
