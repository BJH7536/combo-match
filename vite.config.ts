import { defineConfig } from 'vite';

// GitHub Pages 하위 경로 배포를 위해 상대 base 사용
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
  },
});
