import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../src/core/rng';
import { mulberry32 as refMulberry32 } from './reference/reference-sim';

describe('mulberry32', () => {
  it('레퍼런스 구현과 비트 단위 동일 시퀀스를 생성한다', () => {
    for (const seed of [1, 1234, 98765, 999999, 2 ** 31 - 1]) {
      const ours = mulberry32(seed);
      const ref = refMulberry32(seed);
      for (let i = 0; i < 10; i++) {
        expect(ours()).toBe(ref());
      }
    }
  });
});
