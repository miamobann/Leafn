// 사이드바와 탭 위 버튼 줄 내비게이션의 단일 출처 (docs/prototype-plan.md 3.2)
import {
  ChartLine,
  ClipboardCheck,
  ClipboardList,
  Folder,
  House,
  MessageSquareText,
  Settings,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  /** 기획안 기능 ID (CLAUDE.md 1장) */
  featureId?: string;
  external?: boolean;
  /** 그룹 밖 메뉴(홈, 자료실, 설정)에만 붙인다. 그룹 안 메뉴는 탭 위 버튼 줄에 글자로만 나온다 */
  icon?: LucideIcon;
  /** 주소가 이 메뉴 아래에 있지 않아도 이 메뉴를 켤 화면 (예: 검토 상세는 검토 이력) */
  alsoActive?: RegExp;
  /** 팀장(owner)에게만 보이는 메뉴 (결재함). 주소를 막는 것은 화면과 DB가 따로 한다 */
  ownerOnly?: boolean;
};

export type NavRole = "owner" | "member";

export type NavGroup = {
  label: string;
  /** 펼친 사이드바의 그룹 줄과 접은 아이콘 줄에 같은 아이콘을 쓴다. 그룹 줄을 누르면 첫 메뉴로 간다 */
  icon: LucideIcon;
  items: NavItem[];
};

// 프로모션 캘린더는 홈에 들어가고, /calendar는 홈 캘린더의 전체보기 화면으로만 남는다 (2026-10-24 진출 실행 탭 제거)
export const HOME_ITEM: NavItem = { label: "홈", href: "/", featureId: "J", icon: House, alsoActive: /^\/calendar(\/|$)/ };

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "시장 분석",
    icon: ChartLine,
    items: [
      // 경쟁제품 비교는 시장 분석 안의 「경쟁제품」 탭으로 옮겼다 (2026-10-26). /market/competitors는 그 탭으로 보낸다
      { label: "시장 개요", href: "/market", featureId: "B" },
    ],
  },
  {
    label: "리뷰 분석",
    icon: MessageSquareText,
    items: [
      { label: "리뷰 리포트", href: "/reviews", featureId: "E" },
      { label: "소구점 찾기", href: "/reviews/compare", featureId: "E" },
      // 화면은 제품마다(/reviews/<제품>/translate) 있어서 탭 주소는 안내용 입구(가장 리뷰 많은 자사 제품으로 보낸다)
      { label: "상세페이지용 리뷰", href: "/reviews/translate", featureId: "F", alsoActive: /^\/reviews\/[^/]+\/translate$/ },
    ],
  },
  {
    label: "광고 검토",
    icon: ShieldCheck,
    items: [
      // 기록이 먼저 (2026-10-27 TAB 3): 만든 콘텐츠와 그 문구 검토를 한 목록에서 보고 이어서 한다 → 콘텐츠 만들기 → 문구만 검토. 그룹 줄을 누르면 첫 메뉴(기록)로 간다
      // 콘텐츠 상세(/ad-check/guide/history/<ID>) · 검토 상세(/ad-check/<ID>)도 기록에 속한다 (만들기 화면 /ad-check/guide 와 새 검토 /ad-check 는 제외)
      { label: "기록", href: "/ad-check/history", featureId: "A", alsoActive: /^\/ad-check\/((?!history$|guide$)[^/]+|guide\/history(\/.*)?)$/ },
      { label: "콘텐츠 제작 가이드", href: "/ad-check/guide", featureId: "A" },
      { label: "새 검토", href: "/ad-check", featureId: "A" },
    ],
  },
  {
    // 세 탭의 승인본을 모으는 공통 층 (docs/team-approval-ai-analysis.md 7장 3·4단계). /approvals/<버전 ID> · /ai-analysis/<분석 ID>는 주소 앞부분이 같아 자동으로 켜진다.
    // 결재함은 팀장만 본다. 팀원은 「내 시안」에서 자기가 올린 시안의 팀장 검토 상황을 본다 (2026-10-26 총괄 결정)
    label: "결재 · AI 분석",
    icon: ClipboardCheck,
    items: [
      { label: "결재함", href: "/approvals", featureId: "M", ownerOnly: true },
      { label: "내 시안", href: "/approvals/mine", featureId: "M" },
      { label: "AI 분석", href: "/ai-analysis", featureId: "N" },
    ],
  },
  {
    label: "소비자 설문",
    icon: ClipboardList,
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

const ALL_ITEMS = [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...FOOTER_ITEMS];

function matches(pathname: string, item: NavItem): boolean {
  if (item.alsoActive?.test(pathname)) return true;
  if (item.href === "/") return pathname === "/";
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

/** 지금 주소에서 켤 메뉴의 경로. "/reviews/compare"에서 "/reviews"까지 켜지지 않도록 가장 긴 메뉴 경로 하나만 고른다 */
export function activeHref(pathname: string): string | undefined {
  return ALL_ITEMS.filter((item) => matches(pathname, item))
    .map((item) => item.href)
    .sort((a, b) => b.length - a.length)[0];
}

/** 그 역할에게 보이는 그룹 메뉴 */
export function visibleItems(group: NavGroup, role: NavRole): NavItem[] {
  return group.items.filter((item) => role === "owner" || !item.ownerOnly);
}

export function groupOf(href: string | undefined): NavGroup | undefined {
  return NAV_GROUPS.find((g) => g.items.some((item) => item.href === href));
}
