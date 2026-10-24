"use client";

// 헤더의 워크스페이스 이름. 로그인했으면 실제 워크스페이스 이름으로 바꾼다.
// 서버에서 쿠키를 읽으면 화면 틀 아래 모든 화면이 매 요청마다 다시 그려지므로, 이름 하나는 브라우저에서 읽는다.
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const configured = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

export function WorkspaceName({ fallback }: { fallback: string }) {
  const [name, setName] = useState(fallback);

  useEffect(() => {
    if (!configured) return;
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data: claims } = await supabase.auth.getClaims();
      const userId = claims?.claims?.sub;
      if (!userId) return;
      // 설정 화면(getMyWorkspace)과 같은 규칙: 가장 먼저 들어간 워크스페이스
      const { data } = await supabase
        .from("workspace_members")
        .select("workspaces (name)")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      const ws = Array.isArray(data?.workspaces) ? data.workspaces[0] : data?.workspaces;
      if (!cancelled && ws?.name) setName(ws.name);
    })().catch(() => {
      // 못 읽으면 샘플 이름을 그대로 둔다
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return <span className="truncate text-muted-foreground">{name}</span>;
}
