import { describe, expect, it } from 'vitest';

// 툴체인 스모크 테스트 — 첫 로직 모듈 테스트가 들어오면 삭제 가능
describe('toolchain', () => {
  it('vitest가 동작한다', () => {
    expect(1 + 1).toBe(2);
  });
});
