// 사이드바 내비게이션의 단일 출처 (docs/prototype-plan.md 3.2)
import { Folder, House, Settings, type LucideIcon } from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  /** 기획안 기능 ID (CLAUDE.md 1장) */
  featureId?: string;
  external?: boolean;
  /** 그룹 밖 메뉴(홈, 자료실, 설정)에만 붙인다. 그룹 안 메뉴는 안내선으로 구분한다 */
  icon?: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

export const HOME_ITEM: NavItem = { label: "홈", href: "/", featureId: "J", icon: House };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "시장 분석",
    items: [
      { label: "시장 트렌드", href: "/market/trends", featureId: "B" },
      { label: "성분 관심도", href: "/market/ingredients", featureId: "B" },
      { label: "AI 검색 노출 (GEO)", href: "/market/geo", featureId: "GEO" },
      { label: "경쟁제품 비교", href: "/market/competitors", featureId: "C" },
    ],
  },
  {
    label: "리뷰 분석",
    items: [
      { label: "리뷰 리포트", href: "/reviews", featureId: "E" },
      { label: "소구점 찾기", href: "/reviews/compare", featureId: "E" },
      { label: "리뷰 가져오기", href: "/reviews/import", featureId: "E" },
    ],
  },
  {
    label: "광고 검토",
    items: [
      { label: "새 검토", href: "/ad-check", featureId: "A" },
      { label: "검토 이력", href: "/ad-check/history", featureId: "A" },
    ],
  },
  {
    label: "진출 실행",
    items: [
      { label: "플랫폼별 강점", href: "/platforms", featureId: "H" },
      { label: "프로모션 캘린더", href: "/calendar", featureId: "I" },
    ],
  },
  {
    label: "소비자 설문",
    items: [
      { label: "응답 집계", href: "/survey-results", featureId: "G" },
      { label: "공개 설문 열기 ↗", href: "/survey", featureId: "G", external: true },
    ],
  },
];

export const FOOTER_ITEMS: NavItem[] = [
  { label: "자료실", href: "/library", featureId: "J", icon: Folder },
  { label: "설정", href: "/settings", featureId: "J", icon: Settings },
];
