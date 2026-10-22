import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate, DetailTemplate } from "@/components/templates";
import { getMembers, getWorkspace } from "@/lib/data";

export default async function SettingsPage() {
  const [workspace, members] = await Promise.all([getWorkspace(), getMembers()]);

  return (
    <>
      <PageHeader title="설정" description="워크스페이스와 팀원" featureId="J" />
      <DetailTemplate
        attributes={[
          { label: "워크스페이스", value: workspace.name },
          { label: "초대 코드", value: workspace.invite_code ?? "—" },
        ]}
      />
      <h2 className="mt-8 mb-3 font-semibold">팀원</h2>
      <DataTableTemplate
        columns={[
          { key: "name", label: "이름" },
          { key: "title", label: "직무" },
          { key: "role", label: "역할" },
        ]}
        rows={members.map((m) => ({
          id: m.id,
          cells: { name: m.display_name ?? "—", title: m.title ?? "—", role: m.role === "owner" ? "소유자" : "멤버" },
        }))}
      />
    </>
  );
}
