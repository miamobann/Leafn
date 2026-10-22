import { PlatformNote } from "@/lib/schemas/platform";
import { parseAll, ts, WORKSPACE_ID } from "./helpers";

// 강점·고객층은 샘플 문구, 수수료 수치는 공식 자료 확인 전까지 비워 둔다
export const platforms = parseAll(
  PlatformNote,
  [
    { id: "pl-qoo10", platform: "Qoo10", strengths: "K-뷰티 인지도, 메가와리 집객 (샘플)", audience: "10~30대 여성 (샘플)", channel_type: "ec", status: "live" },
    { id: "pl-rakuten", platform: "楽天市場", strengths: "포인트 경제권, 폭넓은 연령층 (샘플)", audience: "30~50대 (샘플)", channel_type: "ec", status: "preparing" },
    { id: "pl-cosme", platform: "@cosme", strengths: "리뷰·랭킹 신뢰도 (샘플)", audience: "화장품 관심층 (샘플)", channel_type: "review_sns", status: "reviewing" },
    { id: "pl-loft", platform: "버라이어티숍 (ロフト·PLAZA)", strengths: "오프라인 체험 (샘플)", audience: "10~20대 (샘플)", channel_type: "offline", status: "reviewing" },
  ].map((p) => ({ fees_note: null, updated_by: "u-1", ...p, workspace_id: WORKSPACE_ID, created_at: ts("2026-10-12") })),
  "platforms",
);
