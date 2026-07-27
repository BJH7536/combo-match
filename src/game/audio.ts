// 사운드 — WebAudio 런타임 합성. 오디오 파일이 0개인 이유는 skin.ts가 그래픽을 그리는 이유와 같다:
// 외부 에셋 라이선스가 없고 초기 로드 예산(3초)을 먹지 않는다.
// 콤보가 오를수록 음이 높아지는 연출도 합성이면 주파수 계산으로 끝난다 — 음을 녹음해 둘 필요가 없다.
// 오디오를 못 쓰는 환경(자동재생 차단·저장소 차단)에서도 게임이 죽지 않도록 전부 안전 실패시킨다.

const KEY = 'combo-match:muted';

// 장5음 펜타토닉의 반음 계단 — 어떤 순서로 울려도 불협이 없어 콤보 연쇄에 적합하다
const STEPS = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24] as const;
const BASE_HZ = 523.25; // C5

/** 콤보 n단계의 주파수. 계단 끝에서는 더 오르지 않는다 (끝없이 높아지면 귀가 아프다) */
export function comboPitch(combo: number): number {
  const i = Math.min(Math.max(Math.round(combo) - 1, 0), STEPS.length - 1);
  return BASE_HZ * 2 ** (STEPS[i]! / 12);
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = ((): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
})();

/** 오디오 컨텍스트 — 자동재생 정책 때문에 첫 입력 시점에 만들어지고, 잠들어 있으면 깨운다 */
function audio(): AudioContext | null {
  if (muted) return null;
  if (!ctx) {
    try {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    } catch {
      return null; // 오디오가 없는 환경 — 소리만 빠지고 게임은 그대로 돌아간다
    }
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

interface Tone {
  hz: number;
  dur: number;
  type?: OscillatorType;
  gain?: number;
  /** 시작 지연(초) — 아르페지오처럼 음을 흩뿌릴 때 */
  at?: number;
  /** 끝 주파수 — 미끄러지는 소리 */
  to?: number;
}

function tone(o: Tone): void {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + (o.at ?? 0);
  const osc = c.createOscillator();
  osc.type = o.type ?? 'triangle';
  osc.frequency.setValueAtTime(o.hz, t);
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.dur);
  const g = c.createGain();
  // 어택을 아주 짧게 잡아야 타격감이 산다. 감쇠는 지수 — 선형이면 뚝 끊기는 느낌이 난다
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(o.gain ?? 0.3, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + o.dur + 0.03);
}

/** 음정이 없는 소리 — 카드가 스치는 마찰음 */
function noise(dur: number, gain: number, hz: number): void {
  const c = audio();
  if (!c || !master) return;
  const n = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, n, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n); // 뒤로 갈수록 잦아든다
  const src = c.createBufferSource();
  src.buffer = buf;
  const bp = c.createBiquadFilter();
  bp.type = 'bandpass';
  bp.frequency.value = hz;
  const g = c.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(master);
  src.start(c.currentTime);
}

export const sfx = {
  /** 매칭 성공 — 콤보 단계만큼 높아진다. 5도를 겹쳐 두께를 준다 */
  match(combo: number): void {
    const hz = comboPitch(combo);
    tone({ hz, dur: 0.26, gain: 0.32 });
    tone({ hz: hz * 1.5, dur: 0.2, gain: 0.13, at: 0.02 });
  },
  reject(): void {
    tone({ hz: 180, to: 110, dur: 0.18, type: 'sawtooth', gain: 0.16 });
  },
  draw(): void {
    noise(0.16, 0.32, 1800);
  },
  /** 와일드·집게·힌트·게이트 해제 — 반짝이는 3음 상승 */
  sparkle(): void {
    tone({ hz: 880, dur: 0.1, gain: 0.15 });
    tone({ hz: 1174, dur: 0.1, gain: 0.13, at: 0.05 });
    tone({ hz: 1568, dur: 0.16, gain: 0.11, at: 0.1 });
  },
  /** 폭탄 카운트다운 — 임박하면 높고 날카롭게 */
  tick(urgent: boolean): void {
    tone({ hz: urgent ? 1200 : 800, dur: 0.05, type: 'square', gain: urgent ? 0.16 : 0.08 });
  },
  /** 수집·조각 목표 진행 */
  collect(): void {
    tone({ hz: 660, dur: 0.12, gain: 0.2 });
    tone({ hz: 990, dur: 0.18, gain: 0.15, at: 0.07 });
  },
  win(): void {
    [0, 4, 7, 12].forEach((s, i) => tone({ hz: BASE_HZ * 2 ** (s / 12), dur: 0.34, gain: 0.26, at: i * 0.11 }));
  },
  lose(): void {
    [0, -3, -7].forEach((s, i) =>
      tone({ hz: BASE_HZ * 2 ** (s / 12), dur: 0.42, gain: 0.18, at: i * 0.16, type: 'sine' }),
    );
  },
  tap(): void {
    tone({ hz: 420, dur: 0.06, gain: 0.13 });
  },
};

export function isMuted(): boolean {
  return muted;
}

/** 음소거 토글 — 재생 중인 소리까지 즉시 멈춘다. 반환값은 토글 후 상태 */
export function toggleMute(): boolean {
  muted = !muted;
  try {
    localStorage.setItem(KEY, muted ? '1' : '0');
  } catch {
    /* 저장 실패는 무시 — 이번 세션에만 적용된다 */
  }
  if (ctx) void (muted ? ctx.suspend() : ctx.resume());
  return muted;
}
