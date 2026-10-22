import { Placeholder } from "@/components/common/placeholder";
import { PageHeader } from "@/components/layout/page-header";

export default function HomePage() {
  return (
    <>
      <PageHeader title="홈" description="각 탭 결과 요약과 할 일, 최근 활동" featureId="J" />
      <Placeholder />
    </>
  );
}
