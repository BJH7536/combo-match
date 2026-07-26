// 디자이너 툴을 배포본에 싣는다 — tools/level-designer.html(정본)을 public/designer.html로 복사하면서
// 플레이테스트 링크를 우리 게임 주소로 바꾼다. 빌드 전에 자동 실행된다(package.json prebuild).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = resolve(ROOT, 'tools/level-designer.html');
const OUT = resolve(ROOT, 'public/designer.html');

const html = readFileSync(SRC, 'utf8');
const FROM = "const GAME_URL='../game/play.html';";
// 배포본에서 designer.html과 게임(index.html)은 같은 디렉터리에 놓인다
const TO = "const GAME_URL='./index.html';";

if (!html.includes(FROM)) {
  throw new Error(`디자이너 툴에서 GAME_URL 선언을 찾지 못했습니다: ${FROM}`);
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, html.replace(FROM, TO), 'utf8');
console.log('public/designer.html 갱신 (GAME_URL → ./index.html)');
