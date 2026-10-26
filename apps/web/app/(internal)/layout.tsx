import type { Metadata } from "next";
import { Noto_Sans_JP, Noto_Sans_KR } from "next/font/google";
import "../globals.css";

// CJK 글꼴은 용량이 커서 preload를 끈다. 일본어 글꼴은 화면 안의 일본어(lang="ja")용
const notoKr = Noto_Sans_KR({ variable: "--font-noto-kr", subsets: ["latin"], preload: false });
const notoJp = Noto_Sans_JP({ variable: "--font-noto-jp", subsets: ["latin"], preload: false });

export const metadata: Metadata = {
  title: "Leafn",
  description: "K-뷰티 일본 진출 지원 대시보드",
};

export default function InternalRootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${notoKr.variable} ${notoJp.variable} font-sans antialiased`}>{children}</body>
    </html>
  );
}
