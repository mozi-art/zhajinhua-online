// 音效层：WebAudio 程序化合成，零素材文件（与"零运行时依赖"同一口径——浏览器自带的能力也算自带）。
// 四枚短音：翻牌（频率下扫的三角波）、筹码（两记短促方波）、赢（三连上行琶音）、输（下行锯齿）。
// 纪律与 main.ts 相同：只做输出，不判任何规则 —— 什么时候响由调用方决定。
// 默认静音；AudioContext 在首次用户手势时才创建/恢复（浏览器自动播放策略），解锁失败安静降级为"永远无声"。
export type Sfx = {
  /** 首次用户手势时调用：创建 AudioContext 并 resume。失败不抛（无声即降级）。 */
  unlock: () => void;
  setMuted: (muted: boolean) => void;
  isMuted: () => boolean;
  flip: () => void;
  chip: () => void;
  win: () => void;
  lose: () => void;
};

export function createSfx(): Sfx {
  let ctx: AudioContext | null = null;
  let broken = false;
  let muted = true;

  function ensure(): AudioContext | null {
    if (broken || muted) return null;
    if (ctx !== null) return ctx;
    try {
      const Ctor = window.AudioContext;
      if (typeof Ctor !== 'function') {
        broken = true;
        return null;
      }
      ctx = new Ctor();
    } catch {
      broken = true;
      return null;
    }
    return ctx;
  }

  // 一枚带增益包络的振荡器短音：freq 从 f0 滑到 f1，dur 秒内起音-衰减。
  function blip(type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay: number): void {
    const ac = ensure();
    if (ac === null) return;
    try {
      const t0 = ac.currentTime + delay;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(f0, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
      gain.gain.setValueAtTime(0, t0);
      gain.gain.linearRampToValueAtTime(vol, t0 + 0.008);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // 单枚音失败不影响页面：声音是装饰，不是功能
    }
  }

  return {
    unlock: () => {
      if (broken || ctx !== null) return;
      const ac = ensure();
      if (ac !== null && ac.state === 'suspended') void ac.resume().catch(() => {});
    },
    setMuted: (m) => {
      muted = m;
    },
    isMuted: () => muted,
    flip: () => blip('triangle', 660, 300, 0.09, 0.12, 0),
    chip: () => {
      blip('square', 1250, 1100, 0.035, 0.06, 0);
      blip('square', 900, 760, 0.045, 0.06, 0.055);
    },
    win: () => {
      blip('triangle', 523, 523, 0.11, 0.11, 0);
      blip('triangle', 659, 659, 0.11, 0.11, 0.1);
      blip('triangle', 784, 784, 0.16, 0.12, 0.2);
    },
    lose: () => blip('sawtooth', 220, 105, 0.24, 0.07, 0),
  };
}
