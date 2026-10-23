import type { ChannelType, PlatformStatus } from "@/lib/data/launch";

export const CHANNEL: Record<ChannelType, string> = { ec: "판매 EC", review_sns: "리뷰·SNS 홍보", offline: "오프라인" };
export const STATUS: Record<PlatformStatus, string> = { reviewing: "검토", preparing: "준비", live: "입점" };
