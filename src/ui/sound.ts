/**
 * Tiny synthesized sounds (WebAudio) — no audio files, works offline, respects the
 * sound toggle. Kept soft and short so they're pleasant in an office.
 */
let ctx: AudioContext | null = null;
let enabled = true;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.06): void {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  const t = ctx.currentTime + start;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

export type SoundName = 'move' | 'capture' | 'check' | 'good' | 'solve' | 'wrong' | 'end';

export function play(name: SoundName): void {
  if (!enabled) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    return;
  }
  switch (name) {
    case 'move':
      tone(420, 0, 0.07, 'triangle', 0.08);
      break;
    case 'capture':
      tone(300, 0, 0.09, 'triangle', 0.1);
      tone(220, 0.04, 0.08, 'triangle', 0.06);
      break;
    case 'check':
      tone(660, 0, 0.1, 'square', 0.03);
      break;
    case 'good':
      tone(660, 0, 0.1);
      tone(880, 0.07, 0.12);
      break;
    case 'solve':
      tone(523, 0, 0.12);
      tone(659, 0.09, 0.12);
      tone(784, 0.18, 0.2);
      break;
    case 'wrong':
      tone(330, 0, 0.14, 'sine', 0.05);
      tone(294, 0.1, 0.16, 'sine', 0.04);
      break;
    case 'end':
      tone(392, 0, 0.15);
      tone(523, 0.12, 0.25);
      break;
  }
}
