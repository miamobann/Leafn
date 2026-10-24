"use client";

// 프로젝트(제품군) 목록 · 고른 프로젝트의 제품 표 · 추가 폼.
// 로그인한 워크스페이스가 있으면 DB에 저장하고, 아니면 이 브라우저에만 저장한다 (components/layout/project-store.ts)
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type AddResult, type ProjectWithProducts, type StoreSource, useProjects } from "@/components/layout/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { platformLabel } from "@/lib/platforms";
import type { NewProjectProduct, NewProject, SaleStatus, SkinLine } from "@/lib/schemas/project";

const TEXT = {
  notice: {
    loading: "팀 워크스페이스의 프로젝트를 불러오는 중이에요.",
    db: "팀 워크스페이스에 저장돼요. 같은 워크스페이스의 팀원에게도 보여요.",
    not_configured: "DB가 연결되지 않은 환경이라 샘플 데이터를 보여 줘요. 추가한 내용은 이 브라우저에만 저장돼요.",
    signed_out: "로그인하지 않아 샘플 데이터를 보여 줘요. 추가한 내용은 이 브라우저에만 저장돼요.",
    error: "DB에서 불러오지 못해 샘플 데이터를 보여 줘요. 추가한 내용은 이 브라우저에만 저장돼요.",
  },
  projects: "프로젝트",
  products: (n: number) => `제품 ${n}종`,
  newProject: "새 프로젝트",
  projectName: "프로젝트 이름",
  projectNamePlaceholder: "예) Leaf& Dew 바디 라인",
  description: "설명 (선택)",
  platform: "진출 플랫폼",
  platformNote: "시연은 Qoo10만 연결해요. 다른 플랫폼은 나중에 추가해요.",
  create: "만들기",
  cancel: "취소",
  productList: "제품",
  addProduct: "제품 추가",
  productName: "제품 이름",
  productNamePlaceholder: "예) Leaf& Dew Deep Cream",
  skinLine: "피부 라인",
  category: "카테고리",
  categoryPlaceholder: "예) 化粧水",
  status: "판매 상태",
  add: "추가",
  noProducts: "아직 제품이 없어요. 아래에서 추가해 주세요.",
  nameRequired: "이름을 넣어 주세요",
  duplicate: "같은 이름이 이미 있어요",
  current: "헤더에서 고른 프로젝트",
  saving: "저장 중…",
};

function noticeText(source: StoreSource) {
  if (source.kind === "sample") return TEXT.notice[source.reason] + (source.message ? ` (${source.message})` : "");
  return TEXT.notice[source.kind];
}

const SKIN_LINES: { value: SkinLine; label: string }[] = [
  { value: "dry", label: "건성" },
  { value: "oily", label: "지성" },
  { value: "combo", label: "복합성" },
];

const STATUSES: { value: SaleStatus; label: string }[] = [
  { value: "on_sale", label: "판매중" },
  { value: "in_development", label: "개발중" },
];

const SELECT = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm";
const LABEL = "flex flex-col gap-1.5 text-sm";

const skinLabel = (v: SkinLine | null) => SKIN_LINES.find((s) => s.value === v)?.label ?? "—";
const statusLabel = (v: SaleStatus | null) => STATUSES.find((s) => s.value === v)?.label ?? "—";

export function ProjectManager({ base, startWithNewProject }: { base: ProjectWithProducts[]; startWithNewProject: boolean }) {
  const { projects, current, source, select, addProject, addProduct } = useProjects(base);
  const [showNewProject, setShowNewProject] = useState(startWithNewProject);

  return (
    <div className="space-y-4">
      <p role="status" className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
        {noticeText(source)}
      </p>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-1 basis-64">
          <CardHeader>
            <CardTitle>{TEXT.projects}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1">
              {projects.map((project) => (
                <li key={project.id}>
                  <button
                    type="button"
                    onClick={() => select(project.id)}
                    aria-current={project.id === current?.id ? "true" : undefined}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${
                      project.id === current?.id ? "border-foreground/40 bg-muted" : "border-border"
                    }`}
                  >
                    <span className="block font-medium">{project.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {project.platform_id ? `${platformLabel(project.platform_id)} · ` : ""}
                      {TEXT.products(project.products.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {showNewProject ? (
              <NewProjectForm
                existing={projects}
                onCancel={() => setShowNewProject(false)}
                onCreate={async (input) => {
                  const r = await addProject(input);
                  if (r.ok) setShowNewProject(false);
                  return r;
                }}
              />
            ) : (
              <Button variant="outline" className="w-full" onClick={() => setShowNewProject(true)}>
                <Plus aria-hidden />
                {TEXT.newProject}
              </Button>
            )}
          </CardContent>
        </Card>

        {current && (
          <Card className="min-w-0 flex-[3] basis-[28rem]">
            <CardHeader>
              <CardTitle>
                {current.name} · {TEXT.productList}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                {TEXT.current}
                {current.platform_id ? ` · ${platformLabel(current.platform_id)}` : ""}
                {current.description ? ` · ${current.description}` : ""}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {current.products.length === 0 ? (
                <p className="text-sm text-muted-foreground">{TEXT.noProducts}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{TEXT.productName}</TableHead>
                        <TableHead>{TEXT.skinLine}</TableHead>
                        <TableHead>{TEXT.category}</TableHead>
                        <TableHead>{TEXT.status}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {current.products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{skinLabel(p.skin_line)}</TableCell>
                          <TableCell>{p.category ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={p.sale_status === "on_sale" ? "default" : "secondary"}>{statusLabel(p.sale_status)}</Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              <NewProductForm key={current.id} existing={current} onAdd={(input) => addProduct(current.id, input)} />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function NewProjectForm({
  existing,
  onCreate,
  onCancel,
}: {
  existing: ProjectWithProducts[];
  onCreate: (input: NewProject) => Promise<AddResult>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(TEXT.nameRequired);
    if (existing.some((l) => l.name === trimmed)) return setError(TEXT.duplicate);
    setSaving(true);
    const r = await onCreate({ name: trimmed, platform_id: "qoo10", description: description.trim() || null });
    setSaving(false);
    if (!r.ok) setError(r.message);
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3" aria-label={TEXT.newProject}>
      <label className={LABEL}>
        {TEXT.projectName}
        <Input
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
          placeholder={TEXT.projectNamePlaceholder}
          aria-invalid={error ? true : undefined}
          autoFocus
        />
      </label>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <label className={LABEL}>
        {TEXT.description}
        <Input value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className={LABEL}>
        {TEXT.platform}
        <span className="text-sm font-medium">Qoo10</span>
        <span className="text-xs text-muted-foreground">{TEXT.platformNote}</span>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={saving}>
          {saving ? TEXT.saving : TEXT.create}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          {TEXT.cancel}
        </Button>
      </div>
    </form>
  );
}

function NewProductForm({
  existing,
  onAdd,
}: {
  existing: ProjectWithProducts;
  onAdd: (input: NewProjectProduct) => Promise<AddResult>;
}) {
  const [name, setName] = useState("");
  const [skinLine, setSkinLine] = useState<SkinLine | "">("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<SaleStatus>("in_development");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(TEXT.nameRequired);
    if (existing.products.some((p) => p.name === trimmed)) return setError(TEXT.duplicate);
    setSaving(true);
    const r = await onAdd({ name: trimmed, sale_status: status, skin_line: skinLine || null, category: category.trim() || null });
    setSaving(false);
    if (!r.ok) return setError(r.message);
    setName("");
    setCategory("");
    setSkinLine("");
    setStatus("in_development");
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-lg border border-border p-3" aria-label={TEXT.addProduct}>
      <h3 className="text-sm font-medium">{TEXT.addProduct}</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <label className={`${LABEL} sm:col-span-2`}>
          {TEXT.productName}
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError(null);
            }}
            placeholder={TEXT.productNamePlaceholder}
            aria-invalid={error ? true : undefined}
          />
        </label>
        <label className={LABEL}>
          {TEXT.skinLine}
          <select className={SELECT} value={skinLine} onChange={(e) => setSkinLine(e.target.value as SkinLine | "")}>
            <option value="">—</option>
            {SKIN_LINES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={LABEL}>
          {TEXT.status}
          <select className={SELECT} value={status} onChange={(e) => setStatus(e.target.value as SaleStatus)}>
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>
        <label className={`${LABEL} sm:col-span-2`}>
          {TEXT.category}
          <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder={TEXT.categoryPlaceholder} />
        </label>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={saving}>
        <Plus aria-hidden />
        {saving ? TEXT.saving : TEXT.add}
      </Button>
    </form>
  );
}
