import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { DataTableTemplate, DetailTemplate } from "@/components/templates";
import { Button, buttonVariants } from "@/components/ui/button";
import { getMembers, getWorkspace } from "@/lib/data";
import { getCurrentUser, getMyWorkspace, getMyWorkspaceMembers } from "@/lib/data/workspace";
import { signOut } from "@/app/(internal)/(auth)/actions";

const TEXT = {
  title: "설정",
  description: "워크스페이스와 팀원",
  sample: "샘플 데이터입니다. 로그인하면 실제 워크스페이스가 보입니다.",
  login: "로그인",
  noWorkspace: "아직 속한 워크스페이스가 없습니다.",
  onboarding: "워크스페이스 만들기 또는 참여",
  signedInAs: "로그인 계정",
  signOut: "로그아웃",
  workspace: "워크스페이스",
  inviteCode: "초대 코드",
  myRole: "내 역할",
  members: "팀원",
};

const roleLabel = (role: "owner" | "member") => (role === "owner" ? "소유자" : "멤버");

export default async function SettingsPage() {
  const user = await getCurrentUser();
  const mine = user ? await getMyWorkspace() : null;

  const workspace = mine?.workspace ?? (await getWorkspace());
  const members = mine ? await getMyWorkspaceMembers(mine.workspace.id) : await getMembers();

  return (
    <>
      <PageHeader title={TEXT.title} description={TEXT.description} featureId="J" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-border p-4 text-sm">
        {user ? (
          <>
            <span>
              {TEXT.signedInAs}: <b>{user.email}</b>
              {!mine && <span className="ml-2 text-muted-foreground">{TEXT.noWorkspace}</span>}
            </span>
            <div className="flex gap-2">
              {!mine && (
                <Link href="/onboarding" className={buttonVariants({ size: "sm" })}>
                  {TEXT.onboarding}
                </Link>
              )}
              <form action={signOut}>
                <Button type="submit" size="sm" variant="outline">
                  {TEXT.signOut}
                </Button>
              </form>
            </div>
          </>
        ) : (
          <>
            <span className="text-muted-foreground">{TEXT.sample}</span>
            <Link href="/login" className={buttonVariants({ size: "sm" })}>
              {TEXT.login}
            </Link>
          </>
        )}
      </div>

      <DetailTemplate
        attributes={[
          { label: TEXT.workspace, value: workspace.name },
          { label: TEXT.inviteCode, value: workspace.invite_code ?? "—" },
          ...(mine ? [{ label: TEXT.myRole, value: roleLabel(mine.role) }] : []),
        ]}
      />
      <h2 className="mt-8 mb-3 font-semibold">{TEXT.members}</h2>
      <DataTableTemplate
        columns={[
          { key: "name", label: "이름" },
          { key: "title", label: "직무" },
          { key: "role", label: "역할" },
        ]}
        rows={members.map((m) => ({
          id: m.id,
          cells: { name: m.display_name ?? "—", title: m.title ?? "—", role: roleLabel(m.role) },
        }))}
      />
    </>
  );
}
