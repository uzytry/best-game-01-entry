// Every sound is synthesised with WebAudio — no audio files ship with the game.
// Short envelopes on oscillators and filtered noise make the effects; two detuned
// triangle pads under a slow filter make the ambient music, with a soft pentatonic
// bell every few seconds. The context is created on the first user gesture (a
// browser will not start audio before one), and M toggles the master gain.

const MUSIC_NOTES = [220, 261.63, 293.66, 329.63, 392, 440, 523.25];

export function createAudio(muted) {
  let context = null;
  let master = null;
  let musicGain = null;
  let isMuted = muted;
  let musicStarted = false;
  let lastShoot = 0;
  let bellTimer = 0;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume().catch(() => {});
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
      master = context.createGain();
      master.gain.value = isMuted ? 0 : 0.9;
      master.connect(context.destination);
      musicGain = context.createGain();
      musicGain.gain.value = 0.16;
      musicGain.connect(master);
      return true;
    } catch {
      return false;
    }
  }

  function tone({ type = 'sine', from = 440, to = null, duration = 0.15, volume = 0.3, when = 0, destination = null }) {
    if (!context) return;
    const start = context.currentTime + when;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(from, start);
    if (to !== null) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, to), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(destination ?? master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }

  function noise({ duration = 0.2, volume = 0.3, frequency = 1200, type = 'lowpass', when = 0 }) {
    if (!context) return;
    const start = context.currentTime + when;
    const length = Math.max(1, Math.floor(context.sampleRate * duration));
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
  }

  function startMusic() {
    if (!context || musicStarted) return;
    musicStarted = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    filter.connect(musicGain);
    for (const detune of [-6, 5]) {
      const oscillator = context.createOscillator();
      oscillator.type = 'triangle';
      oscillator.frequency.value = 110;
      oscillator.detune.value = detune;
      const gain = context.createGain();
      gain.gain.value = 0.5;
      oscillator.connect(gain);
      gain.connect(filter);
      oscillator.start();
    }
    const lfo = context.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = context.createGain();
    lfoGain.gain.value = 140;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();
  }

  return {
    // Call from any user gesture; also starts the music the first time.
    unlock() {
      if (!ensure()) return;
      startMusic();
    },
    setMuted(muted) {
      isMuted = muted;
      if (master && context) master.gain.setTargetAtTime(muted ? 0 : 0.9, context.currentTime, 0.02);
    },
    isMuted() {
      return isMuted;
    },
    // A soft bell now and then, while the music is running.
    update(dt) {
      if (!context || !musicStarted) return;
      bellTimer -= dt;
      if (bellTimer <= 0) {
        bellTimer = 4 + Math.random() * 5;
        const note = MUSIC_NOTES[Math.floor(Math.random() * MUSIC_NOTES.length)];
        tone({ type: 'sine', from: note, duration: 1.6, volume: 0.06, destination: musicGain });
        tone({ type: 'sine', from: note * 2, duration: 1.1, volume: 0.025, destination: musicGain });
      }
    },
    shoot() {
      if (!context) return;
      const now = performance.now();
      if (now - lastShoot < 55) return; // one blip per volley, not per bolt
      lastShoot = now;
      tone({ type: 'square', from: 880, to: 520, duration: 0.07, volume: 0.08 });
    },
    enemyHit() {
      tone({ type: 'sine', from: 320, to: 180, duration: 0.06, volume: 0.1 });
    },
    enemyDie() {
      noise({ duration: 0.18, volume: 0.22, frequency: 900 });
      tone({ type: 'sine', from: 160, to: 50, duration: 0.2, volume: 0.25 });
    },
    pickup(combo) {
      const base = 660 + Math.min(combo, 8) * 40;
      tone({ type: 'sine', from: base, to: base * 1.5, duration: 0.12, volume: 0.12 });
    },
    levelUp() {
      [523.25, 659.25, 783.99, 1046.5].forEach((note, i) => {
        tone({ type: 'triangle', from: note, duration: 0.3, volume: 0.16, when: i * 0.09 });
      });
    },
    draftPick() {
      tone({ type: 'triangle', from: 392, duration: 0.35, volume: 0.16 });
      tone({ type: 'triangle', from: 587.33, duration: 0.35, volume: 0.12, when: 0.05 });
    },
    hurt() {
      tone({ type: 'sawtooth', from: 140, to: 60, duration: 0.25, volume: 0.3 });
      noise({ duration: 0.15, volume: 0.2, frequency: 500 });
    },
    dash() {
      noise({ duration: 0.18, volume: 0.14, frequency: 2400, type: 'bandpass' });
    },
    waveStart() {
      tone({ type: 'sine', from: 98, to: 55, duration: 0.4, volume: 0.35 });
      tone({ type: 'sine', from: 1046.5, duration: 0.5, volume: 0.05, when: 0.1 });
    },
    bossRoar() {
      tone({ type: 'sawtooth', from: 82, to: 55, duration: 0.9, volume: 0.3 });
      tone({ type: 'sawtooth', from: 87, to: 58, duration: 0.9, volume: 0.3 });
      noise({ duration: 0.8, volume: 0.15, frequency: 300 });
    },
    nova() {
      tone({ type: 'sine', from: 220, to: 880, duration: 0.35, volume: 0.2 });
      noise({ duration: 0.3, volume: 0.12, frequency: 1800, type: 'highpass' });
    },
    victory() {
      [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((note, i) => {
        tone({ type: 'triangle', from: note, duration: 0.5, volume: 0.18, when: i * 0.13 });
      });
    },
    gameOver() {
      [392, 329.63, 261.63, 196].forEach((note, i) => {
        tone({ type: 'triangle', from: note, duration: 0.55, volume: 0.16, when: i * 0.22 });
      });
    },
  };
}
