"use client";

// 프로젝트(제품군) 목록 · 고른 프로젝트의 제품 표 · 추가 폼. 추가한 내용은 이 브라우저에만 저장한다 (components/layout/project-store.ts)
import { Plus } from "lucide-react";
import { type FormEvent, useState } from "react";
import { type LineWithProducts, useProductLines } from "@/components/layout/project-store";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { platformLabel } from "@/lib/platforms";
import type { SaleStatus, SkinType } from "@/lib/schemas/product-line";

const TEXT = {
  notice: "추가한 프로젝트·제품은 이 브라우저에만 저장돼요. 리뷰 분석·광고 검토 화면에는 DB를 연결한 뒤에 나와요.",
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
  skinType: "피부 타입",
  category: "카테고리",
  categoryPlaceholder: "예) 化粧水",
  status: "판매 상태",
  add: "추가",
  linked: "리뷰·비교 연결",
  linkedYes: "연결됨",
  linkedNo: "아직",
  noProducts: "아직 제품이 없어요. 아래에서 추가해 주세요.",
  nameRequired: "이름을 넣어 주세요",
  duplicate: "같은 이름이 이미 있어요",
  current: "헤더에서 고른 프로젝트",
};

const SKIN_TYPES: { value: SkinType; label: string }[] = [
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

const skinLabel = (v: SkinType | null) => SKIN_TYPES.find((s) => s.value === v)?.label ?? "—";
const statusLabel = (v: SaleStatus) => STATUSES.find((s) => s.value === v)?.label ?? v;

export function ProjectManager({ base, startWithNewProject }: { base: LineWithProducts[]; startWithNewProject: boolean }) {
  const { lines, current, select, addLine, addProduct } = useProductLines(base);
  const [showNewProject, setShowNewProject] = useState(startWithNewProject);

  return (
    <div className="space-y-4">
      <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">{TEXT.notice}</p>
      <div className="flex flex-wrap items-start gap-4">
        <Card className="min-w-0 flex-1 basis-64">
          <CardHeader>
            <CardTitle>{TEXT.projects}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <ul className="space-y-1">
              {lines.map((line) => (
                <li key={line.id}>
                  <button
                    type="button"
                    onClick={() => select(line.id)}
                    aria-current={line.id === current?.id ? "true" : undefined}
                    className={`w-full rounded-md border px-3 py-2 text-left text-sm hover:bg-muted ${
                      line.id === current?.id ? "border-foreground/40 bg-muted" : "border-border"
                    }`}
                  >
                    <span className="block font-medium">{line.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {platformLabel(line.platform)} · {TEXT.products(line.products.length)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {showNewProject ? (
              <NewProjectForm existing={lines} onCancel={() => setShowNewProject(false)} onCreate={(input) => {
                addLine(input);
                setShowNewProject(false);
              }} />
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
                {TEXT.current} · {platformLabel(current.platform)}
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
                        <TableHead>{TEXT.skinType}</TableHead>
                        <TableHead>{TEXT.category}</TableHead>
                        <TableHead>{TEXT.status}</TableHead>
                        <TableHead>{TEXT.linked}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {current.products.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell className="font-medium">{p.name}</TableCell>
                          <TableCell>{skinLabel(p.skin_type)}</TableCell>
                          <TableCell>{p.category ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "on_sale" ? "default" : "secondary"}>{statusLabel(p.status)}</Badge>
                          </TableCell>
                          <TableCell className="text-muted-foreground">{p.product_id ? TEXT.linkedYes : TEXT.linkedNo}</TableCell>
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
  existing: LineWithProducts[];
  onCreate: (input: { name: string; platform: "qoo10"; description: string | null }) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(TEXT.nameRequired);
    if (existing.some((l) => l.name === trimmed)) return setError(TEXT.duplicate);
    onCreate({ name: trimmed, platform: "qoo10", description: description.trim() || null });
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
        <Button type="submit">{TEXT.create}</Button>
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
  existing: LineWithProducts;
  onAdd: (input: { name: string; status: SaleStatus; skin_type: SkinType | null; category: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [skinType, setSkinType] = useState<SkinType | "">("");
  const [category, setCategory] = useState("");
  const [status, setStatus] = useState<SaleStatus>("in_development");
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError(TEXT.nameRequired);
    if (existing.products.some((p) => p.name === trimmed)) return setError(TEXT.duplicate);
    onAdd({ name: trimmed, status, skin_type: skinType || null, category: category.trim() || null });
    setName("");
    setCategory("");
    setSkinType("");
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
          {TEXT.skinType}
          <select className={SELECT} value={skinType} onChange={(e) => setSkinType(e.target.value as SkinType | "")}>
            <option value="">—</option>
            {SKIN_TYPES.map((s) => (
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
      <Button type="submit">
        <Plus aria-hidden />
        {TEXT.add}
      </Button>
    </form>
  );
}
