/**
 * AAPNA TIFFIN - NOTIFICATION & PAYMENT SOUND ENGINE
 * Uses Web Audio API for zero-latency, high-fidelity procedural audio chimes
 * with fallback to physical audio files (/sounds/notification.mp3 and /sounds/payment-success.mp3).
 */

let audioCtx = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Normal Notification Sound: A pleasant 2-tone melodic soft chime
 */
export function playNotificationSound() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;

      // Note 1: 523.25 Hz (C5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(523.25, now);
      gain1.gain.setValueAtTime(0.18, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.35);

      // Note 2: 659.25 Hz (E5)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(659.25, now + 0.12);
      gain2.gain.setValueAtTime(0.22, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.55);
      return;
    }
  } catch (err) {
    console.debug('Web Audio API notification chime fallback', err);
  }

  // Fallback to audio element if available
  try {
    const audio = new Audio('/sounds/notification.mp3');
    audio.volume = 0.5;
    audio.play().catch(() => {});
  } catch (e) {}
}

/**
 * Payment Success Sound: A distinct, uplifting 4-note victory / cash register resonance
 */
export function playPaymentSound() {
  try {
    const ctx = getAudioContext();
    if (ctx) {
      const now = ctx.currentTime;
      const notes = [
        { freq: 523.25, start: 0, dur: 0.22, gain: 0.2 },       // C5
        { freq: 659.25, start: 0.08, dur: 0.24, gain: 0.22 },   // E5
        { freq: 783.99, start: 0.16, dur: 0.26, gain: 0.24 },   // G5
        { freq: 1046.50, start: 0.24, dur: 0.65, gain: 0.28 }   // C6 (Triumphant long sustain)
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle'; // Gives a richer harmonic body like coin chime
        osc.frequency.setValueAtTime(n.freq, now + n.start);
        gain.gain.setValueAtTime(n.gain, now + n.start);
        gain.gain.exponentialRampToValueAtTime(0.001, now + n.start + n.dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + n.start);
        osc.stop(now + n.start + n.dur);
      });
      return;
    }
  } catch (err) {
    console.debug('Web Audio API payment chime fallback', err);
  }

  // Fallback to audio element if available
  try {
    const audio = new Audio('/sounds/payment-success.mp3');
    audio.volume = 0.6;
    audio.play().catch(() => {});
  } catch (e) {}
}
