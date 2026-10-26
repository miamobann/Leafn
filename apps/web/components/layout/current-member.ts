// 상단 바 계정 버튼과 홈 인사("안녕하세요, OO님")가 함께 쓰는 "나" (서버 전용)
import { getMembers } from "@/lib/data";
import { getMyTabs } from "@/lib/data/submissions";
import { getCurrentUser } from "@/lib/data/workspace";

/** 로그인한 팀원. 샘플 모드(로그인 없음)에서는 가짜 데이터의 첫 팀장을 "나"로 본다 (getMyTabs도 샘플 모드를 팀장으로 본다) */
export async function getCurrentMember(): Promise<{ name: string; role: "owner" | "member" }> {
  const [user, members, my] = await Promise.all([getCurrentUser(), getMembers(), getMyTabs()]);
  const me = user ? members.find((m) => m.user_id === user.id) : (members.find((m) => m.role === "owner") ?? members[0]);
  // 이름을 아직 안 적은 사람은 이메일 앞부분으로 부른다
  const name = me?.display_name ?? user?.email?.split("@")[0] ?? "팀원";
  return { name, role: my.role };
}
