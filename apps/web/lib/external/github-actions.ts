// 수집기 워크플로(.github/workflows/collect.yml)를 GitHub API로 실행시킨다 (서버 전용, SDK 없이 fetch).
// 토큰은 이 저장소의 Actions 쓰기 권한만 가진 fine-grained 토큰이고, 브라우저에 내보내지 않는다.
// 토큰이 없으면(개발 PC에서 수집기를 직접 켜 두는 경우) 아무것도 하지 않는다.

export type DispatchResult = { ok: true } | { ok: false; reason: "not_configured" | "failed"; message: string };

export async function dispatchCollector(): Promise<DispatchResult> {
  const token = process.env.GITHUB_DISPATCH_TOKEN?.trim();
  if (!token) return { ok: false, reason: "not_configured", message: "자동 실행이 설정되어 있지 않아요 (GITHUB_DISPATCH_TOKEN)." };
  const repo = process.env.GITHUB_DISPATCH_REPO?.trim() || "miamobann/Leafn";
  const ref = process.env.GITHUB_DISPATCH_REF?.trim() || "Leafn_main";
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}/actions/workflows/collect.yml/dispatches`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref }),
      cache: "no-store",
    });
    if (res.status === 204) return { ok: true };
    // 토큰 값은 응답에 없다. 상태 코드와 GitHub의 안내 문구만 돌려준다
    const detail = await res.text().catch(() => "");
    return { ok: false, reason: "failed", message: `GitHub가 실행을 받지 않았어요 (HTTP ${res.status}): ${detail.slice(0, 200)}` };
  } catch {
    return { ok: false, reason: "failed", message: "GitHub에 연결하지 못했어요." };
  }
}
