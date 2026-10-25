// Apify TikTok Scraper (clockworks/tiktok-scraper)로 영상 링크의 캡션·해시태그·조회수·발화 자막을 가져온다 (서버 전용).
// APIFY_TOKEN은 NEXT_PUBLIC_ 없이 서버에서만 읽는다. 영상 파일·커버는 받지 않고, 자막은 TikTok이 만든 일본어 자막만 쓴다
// https://apify.com/clockworks/tiktok-scraper (입력 칸 이름은 2026-10-25 실제 호출로 확인)
import { z } from "zod";

export class ApifyConfigError extends Error {}

const ACTOR = "clockworks~tiktok-scraper";
/** 한 번 실행에 쓸 수 있는 최대 비용 (Apify 최소값이 $0.50). 영상 10개면 실제로는 몇 센트 */
const MAX_CHARGE_USD = "0.5";
/** Apify 쪽 실행 대기 시간(초). 서버 함수 시간 제한(route maxDuration) 안에 끝나게 */
const RUN_TIMEOUT_SEC = "100";
/** AI에 넣는 발화 자막 최대 길이 (긴 영상 대비) */
const MAX_TRANSCRIPT = 3000;

// 응답에서 쓰는 칸만 검증한다
const Item = z.object({
  id: z.string().optional(),
  webVideoUrl: z.string().optional(),
  text: z.string().nullish(),
  createTimeISO: z.string().nullish(),
  playCount: z.number().nullish(),
  diggCount: z.number().nullish(),
  collectCount: z.number().nullish(),
  isAd: z.boolean().nullish(),
  hashtags: z.array(z.object({ name: z.string() })).nullish(),
  authorMeta: z.object({ name: z.string().nullish() }).nullish(),
  videoMeta: z
    .object({
      subtitleLinks: z.array(z.object({ language: z.string(), downloadLink: z.string(), source: z.string().nullish() })).nullish(),
    })
    .nullish(),
  error: z.string().nullish(),
});

export type TikTokPost = {
  url: string;
  author: string;
  caption: string;
  hashtags: string[];
  /** 영상에서 말한 내용 (TikTok 자동 자막, 일본어). 없으면 null */
  transcript: string | null;
  playCount: number | null;
  likeCount: number | null;
  saveCount: number | null;
  /** TikTok이 광고로 표시한 영상인지 (없다고 광고가 아니라는 보장은 없다) */
  isAd: boolean | null;
  postedAt: string | null;
  /** 가져오지 못한 이유 (나머지 칸은 비어 있다) */
  error: string | null;
};

function videoId(url: string): string | null {
  return url.match(/\/(?:video|photo)\/(\d+)/)?.[1] ?? null;
}

/** WebVTT → 글자만 (시간·번호 줄을 빼고 이어 붙인다. 일본어라 띄어쓰기 없이) */
export function vttToText(vtt: string): string {
  return vtt
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && l !== "WEBVTT" && !l.includes("-->") && !/^\d+$/.test(l) && !/^(NOTE|STYLE|Kind:|Language:)/.test(l))
    .join("")
    .slice(0, MAX_TRANSCRIPT);
}

async function fetchTranscript(links: { language: string; downloadLink: string }[], token: string): Promise<string | null> {
  // 일본어 자막만 (eng-US 등은 TikTok 기계 번역이라 쓰지 않는다)
  const ja = links.find((l) => l.language.toLowerCase().startsWith("jpn") || l.language.toLowerCase().startsWith("ja"));
  if (!ja) return null;
  try {
    const res = await fetch(ja.downloadLink, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
    if (!res.ok) return null;
    const text = vttToText(await res.text());
    return text || null;
  } catch {
    return null; // 자막이 없어도 캡션으로 분석한다
  }
}

/** 영상 링크 → 영상 정보 (입력 순서 그대로, 못 가져온 영상은 error 칸에 이유) */
export async function fetchTikTokPosts(urls: string[]): Promise<TikTokPost[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new ApifyConfigError("APIFY_TOKEN이 설정되지 않았어요. apps/web/.env.local에 추가한 뒤 개발 서버를 다시 켜 주세요.");

  const endpoint = new URL(`https://api.apify.com/v2/acts/${ACTOR}/run-sync-get-dataset-items`);
  endpoint.search = new URLSearchParams({ maxTotalChargeUsd: MAX_CHARGE_USD, timeout: RUN_TIMEOUT_SEC }).toString();
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      postURLs: urls,
      downloadSubtitlesOptions: "DOWNLOAD_SUBTITLES",
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      commentsPerPost: 0,
    }),
    cache: "no-store",
  });
  const body: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) throw new ApifyConfigError("APIFY_TOKEN이 올바르지 않아요.");
    const message = z.object({ error: z.object({ message: z.string() }) }).safeParse(body);
    throw new Error(`Apify 오류 (${res.status}): ${message.success ? message.data.error.message : "알 수 없음"}`);
  }
  const items = z.array(z.unknown()).parse(body).flatMap((x) => {
    const parsed = Item.safeParse(x);
    return parsed.success ? [parsed.data] : [];
  });

  return Promise.all(
    urls.map(async (url): Promise<TikTokPost> => {
      const id = videoId(url);
      const it = items.find((x) => (id && (x.id === id || x.webVideoUrl?.includes(id))) || x.webVideoUrl === url);
      const empty = { url, author: "", caption: "", hashtags: [], transcript: null, playCount: null, likeCount: null, saveCount: null, isAd: null, postedAt: null };
      if (!it) return { ...empty, error: "영상 정보를 가져오지 못했어요 (삭제·비공개 영상일 수 있어요)" };
      if (it.error) return { ...empty, error: it.error };
      return {
        url,
        author: it.authorMeta?.name ?? "",
        caption: it.text ?? "",
        hashtags: (it.hashtags ?? []).map((h) => h.name).filter(Boolean),
        transcript: await fetchTranscript(it.videoMeta?.subtitleLinks ?? [], token),
        playCount: it.playCount ?? null,
        likeCount: it.diggCount ?? null,
        saveCount: it.collectCount ?? null,
        isAd: it.isAd ?? null,
        postedAt: it.createTimeISO ?? null,
        error: null,
      };
    }),
  );
}
