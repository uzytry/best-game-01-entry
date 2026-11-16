// All sound is synthesized with WebAudio — no audio files. Short oscillator and
// filtered-noise blips for effects, plus a tiny lookahead sequencer for music
// whose intensity follows the wave. Nothing runs before the first user gesture
// (the AudioContext is created on unlock), so shot mode stays silent by design.
export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let muted = false;
  let musicTimer = null;
  let wave = 1;
  let step = 0;

  function ensure() {
    if (ctx) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone(freq, dur, type, vol, slideTo, when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise(dur, vol, filterFreq, type = 'lowpass', when = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = filterFreq;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  // A minor-key bass pulse with a sparse arpeggio; higher waves add the arp and
  // a faster pulse. 8 steps per bar at 112 BPM.
  const BASS = [110, 110, 130.81, 98, 110, 110, 146.83, 123.47];
  const ARP = [440, 523.25, 659.25, 783.99, 659.25, 523.25, 587.33, 440];
  function scheduleMusic() {
    if (!ctx) return;
    const intensity = Math.min(1, 0.25 + wave * 0.08);
    const bar = Math.floor(step / 8) % 4;
    const i = step % 8;
    if (i % 2 === 0) tone(BASS[(bar * 2 + i / 2) % 8], 0.22, 'triangle', 0.5);
    if (intensity > 0.45 && i % 2 === 1) tone(ARP[(step * 3) % 8], 0.14, 'sine', 0.16);
    if (intensity > 0.75 && i === 4) noise(0.09, 0.1, 6000, 'highpass');
    step += 1;
  }

  return {
    unlock() {
      if (!ensure()) return;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (!musicTimer) musicTimer = window.setInterval(scheduleMusic, 60000 / 112 / 2);
    },
    setMuted(m) {
      muted = m;
      if (master) master.gain.value = m ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
    setWave(w) {
      wave = w;
    },
    stopMusic() {
      if (musicTimer) window.clearInterval(musicTimer);
      musicTimer = null;
    },
    shoot(kind) {
      if (kind === 'lance') tone(880, 0.09, 'sawtooth', 0.12, 220);
      else if (kind === 'mortar') tone(160, 0.14, 'square', 0.14, 60);
      else tone(660 + Math.random() * 120, 0.06, 'square', 0.07, 330);
    },
    hit() {
      noise(0.05, 0.12, 2400, 'bandpass');
    },
    explode(big) {
      noise(big ? 0.5 : 0.25, big ? 0.5 : 0.3, 500);
      tone(big ? 90 : 120, big ? 0.4 : 0.2, 'sine', 0.4, 40);
    },
    pickup() {
      tone(740, 0.07, 'sine', 0.14);
      tone(1108, 0.09, 'sine', 0.12, undefined, 0.06);
    },
    levelup() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.16, 'triangle', 0.16, undefined, i * 0.07));
    },
    nova() {
      tone(180, 0.7, 'sawtooth', 0.3, 1200);
      noise(0.6, 0.4, 900);
    },
    dash() {
      noise(0.16, 0.2, 1800, 'bandpass');
    },
    hurt() {
      tone(140, 0.18, 'sawtooth', 0.3, 55);
    },
    heartHit() {
      tone(98, 0.3, 'sine', 0.4, 49);
    },
    roar() {
      tone(70, 0.9, 'sawtooth', 0.35, 45);
      noise(0.8, 0.25, 300);
    },
    click() {
      tone(520, 0.05, 'sine', 0.1);
    },
    waveClear() {
      [392, 523.25, 659.25].forEach((f, i) => tone(f, 0.14, 'triangle', 0.14, undefined, i * 0.08));
    },
  };
}
