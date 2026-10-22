import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(사용자 홈 등)에 다른 package-lock.json이 있어도 이 저장소를 루트로 쓴다
  outputFileTracingRoot: path.join(__dirname, "../.."),
};

export default nextConfig;
