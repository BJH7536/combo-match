import { defineConfig } from 'vite';

// GitHub Pages 하위 경로 배포를 위해 상대 base 사용
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
  // 레벨 JSON 캐시 버스트용 빌드 식별자 — HTML·JS는 해시 파일명이라 무사하지만 JSON은
  // bare URL이어서 Pages CDN이 옛 버전을 계속 준다 (2026-08-03 실측: 배포 이틀 뒤에도
  // no-store를 무시하고 7/28본 서빙, 쿼리스트링을 붙이면 최신본)
  define: {
    __BUILD_ID__: JSON.stringify(Date.now().toString(36)),
  },
});
