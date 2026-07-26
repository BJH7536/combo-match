import { describe, expect, it } from 'vitest';
import { loadLevel } from '../src/core/level-loader';
import { decodeLevelHash, demoLevel } from '../src/game/level-source';
import { makeLevel } from './fixtures/levels';

// 디자이너 툴 handoff()와 동일한 인코딩 (tools/level-designer.html:1035 strToB64)
const strToB64 = (s: string) => btoa(unescape(encodeURIComponent(s)));

describe('level-source', () => {
  it('디자이너 handoff 해시를 디코드한다 (#level=<b64>, 이모지 UTF-8 안전)', () => {
    const level = makeLevel({
      pool: ['🍓', '🍒', '🍅'],
      active: ['🍓', '🍒'],
      cards: [{ symbols: ['🍓', '🍒'] }, { symbols: ['🍒', '🍅'] }],
      config: { deck: 0 },
    });
    const hash = '#level=' + encodeURIComponent(strToB64(JSON.stringify(level)));
    expect(decodeLevelHash(hash)).toEqual(level);
  });

  it('내보내기 부가 필드(difficulty/metrics 등)가 있어도 로더까지 통과한다', () => {
    const level = makeLevel({
      pool: ['A', 'B', 'C'],
      active: ['A', 'B'],
      cards: [{ symbols: ['A', 'B'] }, { symbols: ['B', 'C'] }],
      config: { deck: 0 },
    });
    const exported = { ...level, difficulty: 3.2, metrics: { pStuck: 0.1 }, economy: {} };
    const hash = '#level=' + encodeURIComponent(strToB64(JSON.stringify(exported)));
    const decoded = decodeLevelHash(hash);
    expect(decoded).not.toBeNull();
    expect(() => loadLevel(decoded!)).not.toThrow();
  });

  it('빈 해시/다른 키/깨진 base64/비 JSON → null (예외 없음)', () => {
    expect(decodeLevelHash('')).toBeNull();
    expect(decodeLevelHash('#foo=bar')).toBeNull();
    expect(decodeLevelHash('#level=%%%')).toBeNull();
    expect(decodeLevelHash('#level=' + encodeURIComponent(strToB64('not json')))).toBeNull();
  });

  it('데모 레벨은 로더 검증을 통과하고 드로우 루프를 체험할 수 있다', () => {
    const rt = loadLevel(demoLevel());
    expect(rt.cards.length).toBeGreaterThanOrEqual(8);
    expect(rt.deck).toBeGreaterThan(0);
    expect(rt.wild).toBeGreaterThan(0);
  });
});
