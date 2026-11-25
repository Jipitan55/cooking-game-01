// Sizzle & Serve — tiny WebAudio synth. All sounds are generated, no audio files.
// The context is created lazily on the first user gesture, so headless screenshot
// runs (which never gesture) stay silent and never throw.
let ctx = null;
let muted = false;

function audioCtx() {
  if (ctx) return ctx;
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  } catch (e) {
    ctx = null;
  }
  return ctx;
}

export function unlockAudio() {
  const c = audioCtx();
  if (c && c.state === 'suspended') c.resume().catch(() => {});
}

export function toggleMute() {
  muted = !muted;
  return muted;
}

export function isMuted() {
  return muted;
}

function tone(freq, dur, type, vol, slideTo) {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  try {
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, c.currentTime);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + dur);
  } catch (e) { /* audio is best-effort */ }
}

function noiseBurst(dur, vol) {
  if (muted) return;
  const c = audioCtx();
  if (!c) return;
  try {
    const len = Math.max(1, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = c.createBufferSource();
    src.buffer = buf;
    const gain = c.createGain();
    gain.gain.setValueAtTime(vol || 0.1, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    src.connect(gain);
    gain.connect(c.destination);
    src.start();
  } catch (e) { /* audio is best-effort */ }
}

/** Play the sound for a world event name (see world.js stepWorld events). */
export function playEvent(name) {
  switch (name) {
    case 'pickup': tone(520, 0.08, 'triangle', 0.1); break;
    case 'place': tone(340, 0.1, 'triangle', 0.1); break;
    case 'take': tone(620, 0.08, 'triangle', 0.1, 880); break;
    case 'plate': tone(440, 0.09, 'sine', 0.12, 660); break;
    case 'chop': noiseBurst(0.07, 0.14); break;
    case 'chopdone': tone(700, 0.08, 'sine', 0.1); tone(940, 0.1, 'sine', 0.1); break;
    case 'ready': tone(880, 0.12, 'sine', 0.12, 1174); break;
    case 'serve':
      tone(523, 0.12, 'triangle', 0.14);
      setTimeout(() => tone(659, 0.12, 'triangle', 0.14), 90);
      setTimeout(() => tone(784, 0.2, 'triangle', 0.14), 180);
      break;
    case 'order': tone(392, 0.1, 'sine', 0.08); break;
    case 'expire': tone(220, 0.3, 'sawtooth', 0.08, 140); break;
    case 'burnt': noiseBurst(0.15, 0.1); tone(180, 0.25, 'sawtooth', 0.07, 110); break;
    case 'error': tone(160, 0.15, 'square', 0.06); break;
    case 'levelup':
      tone(523, 0.1, 'triangle', 0.12);
      setTimeout(() => tone(784, 0.18, 'triangle', 0.12), 100);
      break;
    case 'rush': tone(440, 0.15, 'square', 0.08, 660); break;
    case 'trash': noiseBurst(0.1, 0.08); break;
    case 'over':
      tone(392, 0.2, 'triangle', 0.12);
      setTimeout(() => tone(330, 0.2, 'triangle', 0.12), 180);
      setTimeout(() => tone(262, 0.35, 'triangle', 0.12), 360);
      break;
    default: break;
  }
}
