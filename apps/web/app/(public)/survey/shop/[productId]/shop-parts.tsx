"use client";

import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const COPY = {
  taxIn: "（税込）",
  quantity: "数量",
  decrease: "数量を減らす",
  increase: "数量を増やす",
  cart: "カートに入れる",
  buyNow: "今すぐ購入",
};

/** 대표 이미지: 큰 사진 1장 + 아래 썸네일 (정사각형) */
export function Gallery({ images }: { images: { src: string; alt: string }[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index];
  return (
    <div className="space-y-2">
      <div className="relative aspect-square overflow-hidden rounded-lg border bg-white">
        <Image src={current.src} alt={current.alt} fill sizes="(min-width: 768px) 50vw, 100vw" priority className="object-contain" />
      </div>
      <div className="flex gap-2">
        {images.map((img, i) => (
          <button
            key={img.src}
            type="button"
            onClick={() => setIndex(i)}
            aria-label={img.alt}
            aria-pressed={i === index}
            className={cn("relative size-16 overflow-hidden rounded border", i === index && "border-2 border-[#e8323c]")}
          >
            <Image src={img.src} alt="" fill sizes="64px" className="object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

/** 가격 · 수량 · 버튼. 시연용이라 버튼은 아무 데도 보내지 않는다 */
export function BuyBox({ price }: { price: number }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="space-y-4">
      <p className="text-2xl font-bold">
        {(price * qty).toLocaleString("ja-JP")}円<span className="ml-1 text-sm font-normal text-neutral-500">{COPY.taxIn}</span>
      </p>
      <div className="flex items-center gap-3 text-sm">
        <span className="text-neutral-500">{COPY.quantity}</span>
        <div className="flex items-center rounded border">
          <button type="button" className="size-9" aria-label={COPY.decrease} onClick={() => setQty((q) => Math.max(1, q - 1))}>
            −
          </button>
          <span className="w-10 text-center tabular-nums">{qty}</span>
          <button type="button" className="size-9" aria-label={COPY.increase} onClick={() => setQty((q) => Math.min(10, q + 1))}>
            ＋
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" className="h-12 border-[#e8323c] text-[#e8323c]">
          {COPY.cart}
        </Button>
        <Button className="h-12 bg-[#e8323c] text-white hover:bg-[#d02a33]">{COPY.buyNow}</Button>
      </div>
    </div>
  );
}
