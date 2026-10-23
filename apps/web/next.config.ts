import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(사용자 홈 등)에 다른 package-lock.json이 있어도 이 저장소를 루트로 쓴다
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // 서버 함수가 fs로 읽는 파일 (프롬프트 원문, 더미 이미지)을 배포 번들에 넣는다
  outputFileTracingIncludes: {
    "/api/trends/appeal": ["./prompts/**/*", "./public/mock/appeal/**/*"],
  },
};

export default nextConfig;
