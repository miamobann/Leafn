import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate } from "@/components/templates";
import { getLibraryItems } from "@/lib/data";
import { formatDate } from "@/lib/format";

export default async function LibraryPage() {
  const items = await getLibraryItems();

  return (
    <>
      <PageHeader title="자료실" description="모든 분석 결과를 한곳에서" featureId="J" />
      <DataTableTemplate
        filters={<Input placeholder="검색 (P8에서 연결)" className="w-64" disabled />}
        columns={[
          { key: "title", label: "제목" },
          { key: "type", label: "유형" },
          { key: "date", label: "날짜" },
        ]}
        rows={items.map((i) => ({
          id: `${i.type}-${i.id}`,
          href: i.href,
          cells: { title: i.title, type: <Badge variant="secondary">{i.type}</Badge>, date: formatDate(i.created_at) },
        }))}
      />
    </>
  );
}
