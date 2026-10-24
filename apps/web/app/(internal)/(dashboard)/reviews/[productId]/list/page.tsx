import { notFound } from "next/navigation";
import { getReviewProductById, getReviewsOf } from "@/lib/data/reviews";
import { AppealTopic } from "@/lib/schemas/review";
import { ReviewListView } from "./review-list-view";

export default async function ReviewListPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ topic?: string; polarity?: string }>;
}) {
  const { productId } = await params;
  const query = await searchParams;
  const product = await getReviewProductById(productId);
  if (!product) notFound();
  const reviews = await getReviewsOf(productId);
  // 리포트 근거 패널의 "N건 모두 보기"에서 넘어온 필터
  const topic = AppealTopic.safeParse(query.topic);
  const from = topic.success ? { topic: topic.data, polarity: query.polarity === "negative" ? ("negative" as const) : ("positive" as const) } : null;

  return <ReviewListView product={product} reviews={reviews} from={from} />;
}
