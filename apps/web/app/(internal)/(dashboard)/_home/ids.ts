// 홈에서 다른 곳이 가리키는 요소 id. 서버 화면(page.tsx)과 클라이언트 부품이 함께 쓰므로 "use client"가 없는 파일에 둔다.
// 상단 바의 알림 버튼도 이 id로 온다 (components/layout/top-bar.tsx의 TODO_HREF)
export const HOME_TODO_ID = "home-todo";
