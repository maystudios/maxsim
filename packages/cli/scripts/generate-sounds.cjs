/**
 * Generate pleasant notification and completion WAV sounds.
 *
 * notification.wav — Gentle two-note ascending chime (C5→E5), soft attack/decay
 * complete.wav     — Warm three-note ascending arpeggio (C5→E5→G5), fuller sound
 *
 * Both are 16-bit mono 44100 Hz WAV files, short (<1s), non-intrusive.
 */

const fs = require('node:fs');
const path = require('node:path');

const SAMPLE_RATE = 44100;
const BIT_DEPTH = 16;
const NUM_CHANNELS = 1;

/**
 * Generate a sine wave sample with exponential envelope.
 * @param {number} freq      Frequency in Hz
 * @param {number} duration  Duration in seconds
 * @param {number} attack    Attack time in seconds
 * @param {number} decay     Decay time in seconds (exponential)
 * @param {number} volume    Peak volume 0-1
 * @returns {Float64Array}
 */
function tone(freq, duration, attack = 0.01, decay = 0.3, volume = 0.4) {
  const samples = Math.floor(SAMPLE_RATE * duration);
  const buf = new Float64Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / SAMPLE_RATE;
    // Sine wave
    let sample = Math.sin(2 * Math.PI * freq * t);
    // Envelope: linear attack, exponential decay
    let env;
    if (t < attack) {
      env = t / attack;
    } else {
      env = Math.exp(-(t - attack) / decay);
    }
    buf[i] = sample * env * volume;
  }
  return buf;
}

/**
 * Mix multiple sample arrays together (additive).
 * All arrays are padded to the length of the longest.
 * @param  {...{samples: Float64Array, offset: number}} parts
 * @returns {Float64Array}
 */
function mix(...parts) {
  let maxLen = 0;
  for (const { samples, offset } of parts) {
    const end = Math.floor(offset * SAMPLE_RATE) + samples.length;
    if (end > maxLen) maxLen = end;
  }
  const out = new Float64Array(maxLen);
  for (const { samples, offset } of parts) {
    const start = Math.floor(offset * SAMPLE_RATE);
    for (let i = 0; i < samples.length; i++) {
      out[start + i] += samples[i];
    }
  }
  return out;
}

/**
 * Clamp and convert Float64Array to 16-bit PCM Int16Array.
 * @param {Float64Array} samples
 * @returns {Int16Array}
 */
function toPCM16(samples) {
  const pcm = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    let s = samples[i];
    if (s > 1) s = 1;
    if (s < -1) s = -1;
    pcm[i] = Math.floor(s * 32767);
  }
  return pcm;
}

/**
 * Write a WAV file from PCM16 samples.
 * @param {string} filePath
 * @param {Int16Array} pcmData
 */
function writeWAV(filePath, pcmData) {
  const dataSize = pcmData.length * 2; // 16-bit = 2 bytes per sample
  const fileSize = 44 + dataSize;
  const buf = Buffer.alloc(fileSize);

  // RIFF header
  buf.write('RIFF', 0);
  buf.writeUInt32LE(fileSize - 8, 4);
  buf.write('WAVE', 8);

  // fmt chunk
  buf.write('fmt ', 12);
  buf.writeUInt32LE(16, 16);           // chunk size
  buf.writeUInt16LE(1, 20);            // PCM format
  buf.writeUInt16LE(NUM_CHANNELS, 22); // channels
  buf.writeUInt32LE(SAMPLE_RATE, 24);  // sample rate
  buf.writeUInt32LE(SAMPLE_RATE * NUM_CHANNELS * (BIT_DEPTH / 8), 28); // byte rate
  buf.writeUInt16LE(NUM_CHANNELS * (BIT_DEPTH / 8), 32); // block align
  buf.writeUInt16LE(BIT_DEPTH, 34);    // bits per sample

  // data chunk
  buf.write('data', 36);
  buf.writeUInt32LE(dataSize, 40);

  // Copy PCM data
  const pcmBuf = Buffer.from(pcmData.buffer, pcmData.byteOffset, pcmData.byteLength);
  pcmBuf.copy(buf, 44);

  fs.writeFileSync(filePath, buf);
}

// --- Sound Design ---

// Musical note frequencies (Equal temperament, A4=440)
const C5  = 523.25;
const D5  = 587.33;
const E5  = 659.25;
const G5  = 783.99;
const A5  = 880.00;
const C6  = 1046.50;

// --- Notification Sound ---
// Gentle two-note chime: C5 → E5 with soft harmonics
// Duration: ~0.5s total
function generateNotification() {
  const parts = [
    // Note 1: C5 fundamental + soft octave
    { samples: tone(C5, 0.35, 0.005, 0.20, 0.35), offset: 0 },
    { samples: tone(C6, 0.30, 0.005, 0.15, 0.10), offset: 0 },     // soft octave overtone
    // Note 2: E5 fundamental + soft octave (slightly delayed)
    { samples: tone(E5, 0.40, 0.005, 0.25, 0.35), offset: 0.12 },
    { samples: tone(E5 * 2, 0.30, 0.005, 0.15, 0.08), offset: 0.12 }, // soft overtone
  ];
  return toPCM16(mix(...parts));
}

// --- Completion Sound ---
// Warm ascending arpeggio: C5 → E5 → G5 with richer harmonics
// Duration: ~0.8s total
function generateCompletion() {
  const parts = [
    // Note 1: C5
    { samples: tone(C5, 0.50, 0.005, 0.30, 0.30), offset: 0 },
    { samples: tone(C6, 0.40, 0.005, 0.20, 0.08), offset: 0 },
    // Note 2: E5
    { samples: tone(E5, 0.50, 0.005, 0.30, 0.30), offset: 0.13 },
    { samples: tone(E5 * 2, 0.40, 0.005, 0.20, 0.07), offset: 0.13 },
    // Note 3: G5 (the "resolution" — slightly louder, longer decay)
    { samples: tone(G5, 0.60, 0.005, 0.40, 0.35), offset: 0.26 },
    { samples: tone(G5 * 2, 0.45, 0.005, 0.25, 0.08), offset: 0.26 },
    // Subtle fifth reinforcement for warmth
    { samples: tone(C5, 0.60, 0.005, 0.35, 0.08), offset: 0.26 },
  ];
  return toPCM16(mix(...parts));
}

// --- Generate ---
const soundsDir = path.join(__dirname, '..', 'sounds');
fs.mkdirSync(soundsDir, { recursive: true });

const notificationPath = path.join(soundsDir, 'notification.wav');
const completePath = path.join(soundsDir, 'complete.wav');

writeWAV(notificationPath, generateNotification());
writeWAV(completePath, generateCompletion());

const notifSize = fs.statSync(notificationPath).size;
const complSize = fs.statSync(completePath).size;

console.log(`  [sounds] Generated notification.wav (${notifSize} bytes)`);
console.log(`  [sounds] Generated complete.wav (${complSize} bytes)`);
console.log(`  [sounds] Output: ${soundsDir}`);
