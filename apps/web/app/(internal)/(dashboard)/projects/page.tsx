import { PageHeader } from "@/components/layout/page-header";
import { getProjectsWithProducts } from "@/lib/data";
import { ProjectManager } from "./project-manager";

type ProjectsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

// 헤더의 프로젝트 메뉴에서 들어오는 화면 (사이드바 메뉴에는 없다). ?new=project면 새 프로젝트 폼을 먼저 연다
export default async function ProjectsPage({ searchParams }: ProjectsPageProps) {
  const [lines, params] = await Promise.all([getProjectsWithProducts(), searchParams]);

  return (
    <>
      <PageHeader title="프로젝트·제품 관리" description="프로젝트(제품군)를 만들고, 그 안에 우리 제품을 추가해요" />
      <ProjectManager base={lines} startWithNewProject={params.new === "project"} />
    </>
  );
}
