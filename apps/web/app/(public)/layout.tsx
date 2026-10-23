import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import "../globals.css";

// CJK 글꼴은 용량이 커서 preload를 끈다
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "肌タイプ診断",
};

export default function PublicRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja">
      <body className={`${notoJp.variable} font-sans antialiased`}>
        {/* 각 화면이 폭을 정한다: 문항 화면은 휴대폰 폭, 결과 화면은 PC에서 넓게 */}
        <main className="mx-auto min-h-screen w-full max-w-5xl px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
