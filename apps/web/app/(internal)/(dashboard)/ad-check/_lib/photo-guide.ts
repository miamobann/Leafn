// 촬영 가이드: 정해진 규칙(AI에 보내지 않음) + 결과물의 사진 칸 설명을 모은 컷 리스트.
// 공통 규칙·금지 사항의 원문은 knowledge/content-guide/04-photo.md (분석 보고서·약기법 E14·E8·F11 기준). 화면(클라이언트)에서 바로 쓰려고 여기 사본을 두니, 고칠 때는 두 곳을 같이 고친다.
import type { GalleryShot, GuideBlock, GuideChannel } from "./content-guide-samples";

/** 채널별 사진 비율 */
export const PHOTO_RATIO: Record<GuideChannel, string> = {
  qoo10_detail: "세로 · 폭 860px",
  instagram: "4:5 · 1080×1350",
  x: "16:9 · 1200×675",
  banner: "가로 · 배너 크기",
};

export const PHOTO_RULES = [
  "배경·조명을 한 결과물 안에서 통일 (단색 배경 + 한쪽 조명, 그림자는 약하게)",
  "제품 라벨이 읽히게 정면을 기본으로, 45° 컷은 보조로",
  "제형 컷은 꼭 1장 이상 (물방울·손등에 펴 바른 순간처럼 끈적임 없는 질감이 보이게)",
  "사람이 나오면 피부는 건조·당김 정도만, 보정으로 효과를 과장하지 않기",
  "원본은 고해상도로 받고, 글자가 들어갈 자리를 비워 두기",
];

/** 찍으면 안 되는 것 (약기법·景表法·다른 회사 자산) */
export const PHOTO_DONTS = [
  "연구소·비커·플라스크·의사 가운 같은 권위 연출 (E14, F11)",
  "비포·애프터 비교, 사용 전후 피부 변화 (효과 보증으로 읽힘)",
  "여드름·홍조·트러블 피부 클로즈업 (질환 암시, E8)",
  "순위·수상·할인율이 들어간 배지 (근거 자료가 없을 때)",
  "다른 회사 제품·로고·캐릭터, 허락받지 않은 인물 사진",
];

/** 블록별 기본 촬영 지시: AI가 사진 칸을 비웠을 때(예전에 만든 가이드 포함) 채운다. 글만 있는 블록도 어떤 그래픽으로 만들지 적는다.
 *  상세페이지는 예전 촬영 가이드(컷 리스트 15컷)와 같은 내용이다 */
const SHOT_DEFAULTS: Partial<Record<GuideChannel, Record<string, string>>> = {
  qoo10_detail: {
    hook: "계절 배경 + 제품 단독 컷 (단색 배경, 45° 조명, 바닥 그림자)",
    concern: "건조한 피부결 클로즈업 (당김·각질 느낌, 질환처럼 보이지 않게)",
    routine: "스킨·에센스를 STEP 1 → 2 순서로 나란히 놓은 컷 (화살표 그래픽)",
    hero: "제품 단독 정면 컷 (제품 컬러 배경, 드롭 섀도우)",
    points: "3포인트 원형 아이콘 인포그래픽",
    ingredient: "성분 원료 2×2 타일 (원료 실사 또는 일러스트, 성분명 라벨)",
    texture: "제형 접사: 물방울 매크로 컷 또는 손등에 펴 바른 컷",
    howto: "모델 사용 컷: 손바닥으로 얼굴에 펴 바르는 장면 (편안한 표정)",
    review: "리뷰 말풍선 그래픽 (ID 마스킹, 별점은 실제 수치일 때만)",
    lineup: "스킨·에센스 단체 컷 + 제품별 한 줄 설명 표",
    info: "상품 정보 표 그래픽 (흰 배경, 용량·전성분·제조판매원을 표로, 작은 글씨도 읽히게)",
  },
  instagram: { slide: "4:5 세로 컷 (제품 · 제형 · 피부 중 이 장의 문구에 맞는 컷, 배경·조명은 다른 장과 통일)" },
  x: { image: "제품 단독 컷 16:9 (단색 배경, 글자 자리는 비우기)" },
  banner: { copy: "가로형 배경 + 제품 단독 컷 (카피 자리 비우기)" },
};

/** 사진 칸이 빈 블록에 기본 촬영 지시를 채운다 (근거 자료 칸은 사진이 아니라 그대로) */
export function withShotDefaults(blocks: GuideBlock[], channel: GuideChannel): GuideBlock[] {
  const defaults = SHOT_DEFAULTS[channel] ?? {};
  return blocks.map((b) => {
    if (b.image || b.needs_evidence) return b;
    const image = defaults[b.key] ?? (b.key.startsWith("slide") ? defaults.slide : undefined);
    return image ? { ...b, image } : b;
  });
}

export type CutRow = { no: number; use: string; ratio: string; image: string };

/** 결과물의 사진 칸 설명을 모아 컷 리스트를 만든다 (갤러리 → 본문 순서) */
export function buildCutList(channel: GuideChannel, blocks: GuideBlock[], gallery: GalleryShot[]): CutRow[] {
  const rows: Omit<CutRow, "no">[] = [
    ...gallery.map((g, i) => ({ use: `대표 이미지 ${i + 1} · ${g.role}`, ratio: "1:1 정사각형", image: g.image })),
    ...blocks.flatMap((b, i) => (b.image ? [{ use: channel === "qoo10_detail" ? `상세 ${i + 1}장 · ${b.heading}` : b.heading, ratio: PHOTO_RATIO[channel], image: b.image }] : [])),
  ];
  return rows.map((r, i) => ({ no: i + 1, ...r }));
}
