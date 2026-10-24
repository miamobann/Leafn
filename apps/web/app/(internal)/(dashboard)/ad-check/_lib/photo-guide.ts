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

export type CutRow = { no: number; use: string; ratio: string; image: string };

/** 결과물의 사진 칸 설명을 모아 컷 리스트를 만든다 (갤러리 → 본문 순서) */
export function buildCutList(channel: GuideChannel, blocks: GuideBlock[], gallery: GalleryShot[]): CutRow[] {
  const rows: Omit<CutRow, "no">[] = [
    ...gallery.map((g, i) => ({ use: `대표 이미지 ${i + 1} · ${g.role}`, ratio: "1:1 정사각형", image: g.image })),
    ...blocks.flatMap((b, i) => (b.image ? [{ use: channel === "qoo10_detail" ? `상세 ${i + 1}장 · ${b.heading}` : b.heading, ratio: PHOTO_RATIO[channel], image: b.image }] : [])),
  ];
  return rows.map((r, i) => ({ no: i + 1, ...r }));
}
