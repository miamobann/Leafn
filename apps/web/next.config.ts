import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 상위 폴더(사용자 홈 등)에 다른 package-lock.json이 있어도 이 저장소를 루트로 쓴다
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // 서버 함수가 fs로 읽는 파일 (프롬프트 원문, 더미 이미지)을 배포 번들에 넣는다
  outputFileTracingIncludes: {
    "/api/geo/run": ["./prompts/**/*"],
    // 시장 분석: SNS 핵심 니즈, 검색 추천어 번역, 경쟁제품 1:1 비교 번역(화면의 Server Action이라 페이지 경로)
    "/api/market/sns-trends": ["./prompts/**/*"],
    "/api/trends/autocomplete": ["./prompts/**/*"],
    "/market": ["./prompts/**/*"],
  },
};

export default nextConfig;
