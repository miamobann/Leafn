// TikTok 링크 해석 (네트워크 호출 없음, 순수 함수).
// 공식 oEmbed가 2026-10 현재 캡션·작성자를 주지 않아서, 링크에서 작성자·ID만 읽고 영상은 공식 임베드 플레이어로 보여준다.
// 영상 내용(발화·댓글)은 마케터 메모로 받는다 (페이지 스크래핑은 이용약관상 하지 않는다, CLAUDE.md 8장)

export type TikTokLink = {
  id: string;
  author: string;
  kind: "video" | "photo";
  /** 추적용 쿼리(?q=, t=)를 뺀 주소 */
  url: string;
  /** 공식 임베드 플레이어 주소. 사진 게시물은 임베드가 안 돼 null */
  embedUrl: string | null;
};

export function parseTikTokLink(raw: string): TikTokLink | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/(^|\.)tiktok\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/^\/@([^/]+)\/(video|photo)\/(\d+)/);
  if (!m) return null;
  const [, author, kind, id] = m;
  return {
    id,
    author,
    kind: kind as "video" | "photo",
    url: `https://www.tiktok.com/@${author}/${kind}/${id}`,
    embedUrl: kind === "video" ? `https://www.tiktok.com/player/v1/${id}?description=1&music_info=1` : null,
  };
}
