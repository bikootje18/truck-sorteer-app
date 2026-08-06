let ctx: AudioContext | null = null;

/** Haptic + audio cue. Never throws (AudioContext is absent in tests/older devices). */
export function feedback(kind: 'ok' | 'warn'): void {
  try {
    navigator.vibrate?.(kind === 'ok' ? 80 : [120, 80, 120]);
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = kind === 'ok' ? 880 : 220;
    osc.connect(gain);
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* no feedback available */
  }
}
