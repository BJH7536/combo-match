// 경량 타입드 이미터 — Phaser 비의존 (테스트·시뮬레이션·초기 로드 예산).
// app-shell이 Phaser EventEmitter로 브리지한다.
export type Listener<T> = (payload: T) => void;

export class Emitter<M extends Record<string, unknown>> {
  private readonly map = new Map<keyof M, Set<Listener<never>>>();

  on<K extends keyof M>(key: K, fn: Listener<M[K]>): () => void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(fn as Listener<never>);
    return () => set.delete(fn as Listener<never>);
  }

  emit<K extends keyof M>(key: K, payload: M[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of set) (fn as Listener<M[K]>)(payload);
  }
}
