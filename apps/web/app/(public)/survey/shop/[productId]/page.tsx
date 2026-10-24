import { CalendarCheck, Droplets, Hand, Wind } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProducts } from "@/lib/data";
import { ownProductName } from "@/lib/own-products";
import { CAUTION, SHOP_CONTENT, SHOP_PRODUCT_IDS, type ShopProductId } from "../content";
import { BuyBox, Gallery } from "./shop-parts";

// Qoo10 상세페이지 모양 (설문 결과 「購入する」 → 여기). 실제 구매 · 결제는 하지 않는다
const COPY = {
  back: "← 診断結果に戻る",
  shop: "Leaf& 公式ショップ",
  tabs: { detail: "商品詳細", info: "商品情報" },
  routineTitle: "洗顔後の2ステップで、うるおいケア",
  ingredientNote: "※保湿成分",
  pointNote: "※浸透：角質層まで",
  reviewTitle: "国内でご愛用いただいている方の声",
  lineupTitle: "ラインナップ",
  infoTitle: "商品情報",
  infoNote: "内容量・全成分・使用上の注意・製造販売元は商品情報欄をご確認ください。",
  imageNote: "※画像はイメージです",
  info: { volume: "内容量", kind: "種類", ingredients: "全成分", caution: "使用上の注意", maker: "製造販売元", origin: "原産国" },
};

const ICONS = { droplets: Droplets, wind: Wind, calendar: CalendarCheck, hand: Hand };

export function generateStaticParams() {
  return SHOP_PRODUCT_IDS.map((productId) => ({ productId }));
}

function isShopProduct(id: string): id is ShopProductId {
  return (SHOP_PRODUCT_IDS as readonly string[]).includes(id);
}

export default async function ShopProductPage({ params }: { params: Promise<{ productId: string }> }) {
  const { productId } = await params;
  if (!isShopProduct(productId)) notFound();
  const content = SHOP_CONTENT[productId];
  const name = ownProductName(productId);
  const product = (await getProducts({ kind: "own" })).find((p) => p.name === name);
  if (!product || product.price_jpy === null) notFound();

  return (
    <div className="-mx-5 -my-8 bg-white text-neutral-900">
      <header className="flex items-center gap-3 bg-[#e8323c] px-4 py-2.5 text-white">
        <span className="text-xl font-extrabold tracking-tight">Qoo10</span>
        <span className="truncate rounded bg-white/90 px-3 py-1 text-xs text-neutral-500 sm:w-80">韓国 化粧水</span>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-4">
        <Link href="/survey/result" className="text-sm text-neutral-500 underline-offset-4 hover:underline">
          {COPY.back}
        </Link>

        <section className="mt-3 grid gap-6 md:grid-cols-2">
          <Gallery images={content.gallery} />
          <div className="space-y-4">
            <p className="text-sm text-[#e8323c]">{COPY.shop}</p>
            <h1 className="text-lg font-semibold leading-snug">
              {content.title} {product.volume_ml}mL
            </h1>
            <BuyBox price={product.price_jpy} />
          </div>
        </section>

        <nav className="sticky top-0 z-10 mt-8 flex border-b bg-white text-sm">
          <a href="#detail" className="flex-1 border-b-2 border-[#e8323c] py-3 text-center font-semibold">
            {COPY.tabs.detail}
          </a>
          <a href="#info" className="flex-1 py-3 text-center text-neutral-500">
            {COPY.tabs.info}
          </a>
        </nav>

        {/* 상세페이지 본문: 폭 860px (콘텐츠 제작 보고서 촬영 가이드) */}
        <article id="detail" className="mx-auto max-w-[860px] divide-y">
          <Image src={content.hook.src} alt={content.hook.alt} width={1200} height={895} className="h-auto w-full" />

          <section className="bg-neutral-50 px-6 py-14 text-center">
            {content.worry.map((line) => (
              <p key={line} className="text-xl font-semibold leading-relaxed md:text-2xl">
                {line}
              </p>
            ))}
          </section>

          <section className="px-6 py-14 text-center">
            <p className="text-xl font-semibold">{COPY.routineTitle}</p>
            <div className="mt-6 flex items-center justify-center gap-3 text-sm md:gap-6">
              {(["deep-skin", "core-essence"] as const).map((id, i) => (
                <div key={id} className="flex items-center gap-3 md:gap-6">
                  {i > 0 && <span className="text-2xl text-neutral-400">→</span>}
                  <div className={`rounded-xl border px-4 py-5 ${id === productId ? "border-[#e8323c]" : ""}`}>
                    <p className="text-xs font-bold text-[#e8323c]">STEP{i + 1}</p>
                    <p className="mt-1 font-semibold">{ownProductName(id)}</p>
                    <p className="text-xs text-neutral-500">{SHOP_CONTENT[id].kind}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="pb-10">
            <Image src={content.gallery[0].src} alt={content.gallery[0].alt} width={1600} height={1066} className="h-auto w-full" />
            <p className="mt-6 text-center text-2xl font-semibold">{name}</p>
          </section>

          <section className="bg-[#eef5f0] px-6 py-14">
            <ol className="grid gap-6 sm:grid-cols-3">
              {content.points.map((p, i) => {
                const Icon = ICONS[p.icon];
                return (
                  <li key={p.text} className="flex flex-col items-center gap-3 text-center">
                    <span className="flex size-20 items-center justify-center rounded-full bg-white shadow-sm">
                      <Icon className="size-9 text-[#4f7d63]" aria-hidden />
                    </span>
                    <span className="text-xs font-bold text-[#4f7d63]">POINT {i + 1}</span>
                    <span className="font-semibold">{p.text}</span>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 text-center text-xs text-neutral-500">{COPY.pointNote}</p>
          </section>

          <section className="px-6 py-14">
            <ul className="grid grid-cols-2 gap-3">
              {content.ingredients.map((ing) => (
                <li key={ing} className="flex aspect-[2/1] items-center justify-center rounded-xl bg-[#f4f8fb] text-lg font-semibold">
                  {ing}※
                </li>
              ))}
            </ul>
            <p className="mt-3 text-right text-xs text-neutral-500">{COPY.ingredientNote}</p>
          </section>

          <section className="bg-gradient-to-b from-[#e6f1f6] to-white px-6 py-16 text-center">
            {content.texture.map((line) => (
              <p key={line} className="text-xl font-semibold leading-relaxed md:text-2xl">
                {line}
              </p>
            ))}
          </section>

          <section className="px-6 py-14 text-center">
            <p className="text-lg leading-relaxed">{content.howTo}</p>
          </section>

          <section className="bg-neutral-50 px-6 py-14">
            <p className="mb-6 text-center text-sm text-neutral-500">{COPY.reviewTitle}</p>
            <ul className="space-y-4">
              {content.reviews.map((r, i) => (
                <li key={r} className={`flex ${i % 2 ? "justify-end" : ""}`}>
                  <span className="rounded-2xl bg-white px-5 py-3 shadow-sm">「{r}」</span>
                </li>
              ))}
            </ul>
          </section>

          <section className="px-6 py-14">
            <p className="mb-6 text-center text-lg font-semibold">{COPY.lineupTitle}</p>
            <ul className="grid grid-cols-2 gap-4">
              {(["deep-skin", "core-essence"] as const).map((id) => (
                <li key={id}>
                  <Link
                    href={`/survey/shop/${id}`}
                    className={`block rounded-xl border p-4 text-center hover:bg-neutral-50 ${id === productId ? "border-[#e8323c]" : ""}`}
                  >
                    <p className="font-semibold">{ownProductName(id)}</p>
                    <p className="text-sm text-neutral-500">（{SHOP_CONTENT[id].kind}）</p>
                  </Link>
                </li>
              ))}
            </ul>
            <p className="mt-8 text-center text-sm text-neutral-500">{COPY.infoNote}</p>
          </section>
        </article>

        <section id="info" className="mx-auto mt-10 max-w-[860px] scroll-mt-14">
          <h2 className="mb-3 font-semibold">{COPY.infoTitle}</h2>
          <dl className="divide-y border-y text-sm">
            {[
              [COPY.info.volume, `${product.volume_ml}mL`],
              [COPY.info.kind, content.kind],
              [COPY.info.ingredients, content.fullIngredients],
              [COPY.info.caution, CAUTION],
              [COPY.info.maker, "Leaf&"],
              [COPY.info.origin, "韓国"],
            ].map(([k, v]) => (
              <div key={k} className="grid grid-cols-[7rem_1fr] gap-3 py-3">
                <dt className="text-neutral-500">{k}</dt>
                <dd className="leading-relaxed">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-neutral-500">{COPY.imageNote}</p>
        </section>
      </div>
    </div>
  );
}
