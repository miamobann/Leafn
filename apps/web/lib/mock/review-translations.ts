import { ReviewTranslation } from "@/lib/schemas/review";
import { parseAll, ts } from "./helpers";

export const reviewTranslations = parseAll(
  ReviewTranslation,
  [
    { id: "rt-1", review_id: "r-ko-1", text_ja: "やさしくてしっとりするのでリピートしました。", ad_check_id: "ac-2", status: "approved" },
    { id: "rt-2", review_id: "r-ko-5", text_ja: "肌荒れが治りました。", ad_check_id: "ac-1", status: "draft" },
  ].map((r) => ({ ...r, created_at: ts("2026-10-20") })),
  "reviewTranslations",
);
