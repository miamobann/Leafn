"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { ChannelType, PlatformView } from "@/lib/data/launch";
import { CHANNEL, STATUS } from "./labels";

const GROUPS: (ChannelType | null)[] = ["ec", "review_sns", "offline", null];

export function PlatformBoard({ platforms, nextEvent }: { platforms: PlatformView[]; nextEvent: Record<string, string | null> }) {
  const [view, setView] = useState<"card" | "table">("card");

  return (
    <>
      <div className="mb-4 flex gap-2" role="group" aria-label="보기 방식">
        <Button variant={view === "card" ? "default" : "outline"} size="sm" onClick={() => setView("card")} aria-pressed={view === "card"}>
          카드 보기
        </Button>
        <Button variant={view === "table" ? "default" : "outline"} size="sm" onClick={() => setView("table")} aria-pressed={view === "table"}>
          표 보기
        </Button>
      </div>

      {view === "card" ? (
        GROUPS.map((g) => {
          const items = platforms.filter((p) => p.channel === g);
          if (items.length === 0) return null;
          return (
            <section key={g ?? "none"} className="mb-6">
              <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{g ? CHANNEL[g] : "분류 전"}</h2>
              <div className="grid grid-cols-3 gap-4">
                {items.map((p) => (
                  <Link key={p.id} href={`/platforms/${p.id}`}>
                    <Card className="h-full hover:bg-muted/50">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between gap-2">
                          {p.name}
                          {p.status && <Badge variant="outline">{STATUS[p.status]}</Badge>}
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-1 text-sm">
                        <p>{p.strengths}</p>
                        <p className="text-muted-foreground">{p.audience}</p>
                        {nextEvent[p.id] && <p className="pt-1 text-xs">다음 행사: {nextEvent[p.id]}</p>}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          );
        })
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>플랫폼</TableHead>
                <TableHead>채널</TableHead>
                <TableHead>우리 상태</TableHead>
                <TableHead>강점</TableHead>
                <TableHead>주 고객층</TableHead>
                <TableHead>수수료</TableHead>
                <TableHead>다음 행사</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {platforms.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">
                    <Link href={`/platforms/${p.id}`} className="underline-offset-4 hover:underline">
                      {p.name}
                    </Link>
                  </TableCell>
                  <TableCell>{p.channel ? CHANNEL[p.channel] : "—"}</TableCell>
                  <TableCell>{p.status ? STATUS[p.status] : "—"}</TableCell>
                  <TableCell>{p.strengths}</TableCell>
                  <TableCell>{p.audience}</TableCell>
                  <TableCell className="text-muted-foreground">{p.feesNote ?? "확인 전"}</TableCell>
                  <TableCell className="text-xs">{nextEvent[p.id] ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </>
  );
}
