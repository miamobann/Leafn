"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { HelpTip } from "@/components/common/help-tip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parseQoo10RankingCsv } from "@/lib/external/qoo10-ranking-csv";
import { MARKET_CATEGORIES } from "@/lib/market-config";
import type { RankingItem } from "@/lib/schemas/trend";
import { saveRankingCsv } from "@/lib/data/ranking-import-actions";

// 플랫폼 분석의 [랭킹 CSV 올리기] (2026-10-26). 팀 Qoo10 랭킹 수집 CSV를 DB(trend_snapshots)에 저장해 배포 서버에서도 같은 실데이터를 본다
const FIELD = "grid gap-1 text-xs font-medium text-muted-foreground";
const SELECT = "h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground";

/** 파일 수정 날짜 (YYYY-MM-DD, 한국·일본 시간) — 수집 날짜 기본값 */
function fileDate(file: File): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Tokyo" }).format(new Date(file.lastModified));
}

export function RankingUpload({ defaultCategory }: { defaultCategory: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [ranking, setRanking] = useState<RankingItem[] | null>(null);
  const [category, setCategory] = useState(defaultCategory);
  const [date, setDate] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [saving, startSaving] = useTransition();

  async function readFile(file: File | undefined) {
    setMessage(null);
    if (!file) return;
    setFileName(file.name);
    setDate(fileDate(file));
    const items = parseQoo10RankingCsv(await file.text());
    setRanking(items);
    if (items.length === 0) setMessage({ tone: "error", text: "랭킹을 읽지 못했어요. 팀 Qoo10 랭킹 수집 CSV(순수_랭킹 · 정상가(정가) 열)인지 확인해 주세요." });
  }

  function save() {
    if (!ranking || ranking.length === 0) return;
    startSaving(async () => {
      const r = await saveRankingCsv({ category, captured_date: date, file_name: fileName, ranking });
      if (r.ok) {
        setMessage({ tone: "ok", text: `${category} 랭킹 ${r.data.count}개를 ${date} 수집으로 저장했어요` });
        setRanking(null);
        router.refresh();
      } else {
        setMessage({ tone: "error", text: r.message });
      }
    });
  }

  if (!open) {
    return (
      <div className="flex justify-end">
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          랭킹 CSV 올리기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border bg-card p-3">
      <p className="flex items-center gap-1.5 text-sm font-medium">
        랭킹 CSV 올리기 (Qoo10)
        <HelpTip>
          <span className="block">팀 Qoo10 랭킹 수집 CSV를 그대로 올리면 DB에 저장돼서, 배포 링크에서도 같은 실데이터로 보여요.</span>
          <span className="block">같은 카테고리·수집 날짜로 다시 올리면 덮어써요. 날짜를 다르게 올리면 주별 변화(순위 변동·신규 진입)를 비교할 수 있어요.</span>
        </HelpTip>
      </p>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={FIELD}>
          CSV 파일
          <Input type="file" accept=".csv,text/csv" onChange={(e) => readFile(e.target.files?.[0])} />
        </label>
        <label className={FIELD}>
          카테고리
          <select className={SELECT} value={category} onChange={(e) => setCategory(e.target.value)}>
            {MARKET_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          수집 날짜
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
      </div>
      {ranking && ranking.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {ranking.length}개 읽음 · 1위 <span lang="ja">{ranking.toSorted((a, b) => a.rank - b.rank)[0]?.name.slice(0, 40)}</span>
        </p>
      )}
      {message && (
        <Alert variant={message.tone === "error" ? "destructive" : "default"}>
          <AlertDescription>{message.text}</AlertDescription>
        </Alert>
      )}
      <div className="flex gap-2">
        <Button size="sm" onClick={save} disabled={!ranking || ranking.length === 0 || !date || saving}>
          {saving ? "저장 중…" : "저장"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
          닫기
        </Button>
      </div>
    </div>
  );
}
