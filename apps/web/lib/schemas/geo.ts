import { z } from "zod";
import { Timestamp, WorkspaceRow } from "./common";

// (참조 GEO)
export const GeoSnapshot = WorkspaceRow.extend({
  engine: z.string(),
  query: z.string(),
  answer: z.string(),
  brands_mentioned: z.array(z.string()),
  captured_at: Timestamp,
});
export type GeoSnapshot = z.infer<typeof GeoSnapshot>;
