/**
 * Tray icon renderer — exact port of the TASK-FM Circle Wave · Menu Bar model.
 *
 * Parameters taken verbatim from circle-wave-menubar-main.js:
 *   waveScale=0.23, waveCount=9, circleWeight=0.6, glowStrength=0.1
 *   manualAmp=0.39, manualSpeed=2.0, manualFreq=3.0, manualBreath=3.0
 *   mouseInteraction=OFF, motionMode=manual (breathSpeed=0)
 *
 * Idle:   amp=0 → wave invisible, white ring remains
 * Active: amp→1 → wave animates gold
 */

const DRIVE  = 2.4;
const GOLDEN = Math.PI * 1.6180339;

function softClamp(raw: number, limit: number): number {
  if (limit <= 0) return 0;
  return limit * Math.tanh((raw / limit) * DRIVE);
}

export interface TrayWaveState {
  time:   number;
  active: boolean;
  amp:    number;   // 0.0 (idle/white) → 1.0 (active/gold)
}

// ── Menubar model constants (verbatim from circle-wave-menubar-main.js) ─────────
const WAVE_SCALE    = 0.23;
const WAVE_COUNT    = 9;
const CIRCLE_WEIGHT = 0.6;
const GLOW_STRENGTH = 0.1;
const MANUAL_AMP    = 0.39;
const MANUAL_SPEED  = 2.0;
const MANUAL_FREQ   = 3.0;
const BREATH_DEPTH  = (3.0 - 1) * 0.5;
const HUE           = Math.round(0.11 * 360);  // 40° = gold
const SAT           = 85;

export function renderTrayFrame(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  s: TrayWaveState,
): void {
  ctx.clearRect(0, 0, W, H);

  const cx = W / 2;
  const cy = H / 2;
  const R  = Math.min(W, H) * 0.38;
  const t  = Math.max(0, Math.min(1, s.amp));

  // Color: white when idle (t=0), gold when active (t=1)
  const col = (l: number, a: number): string => {
    if (t <= 0) return `rgba(255,255,255,${a.toFixed(3)})`;
    if (t >= 1) return `hsla(${HUE},${SAT}%,${l}%,${a.toFixed(3)})`;
    const r = Math.round(255 - 11 * t);
    const g = Math.round(255 - 51 * t);
    const b = Math.round(255 - 132 * t);
    return `rgba(${r},${g},${b},${a.toFixed(3)})`;
  };

  const breath  = 1 + BREATH_DEPTH * (Math.sin(s.time * 0.4) * 0.5 + 0.5);
  const lsAmp   = MANUAL_AMP * breath;
  const lsFreq  = MANUAL_FREQ;
  const mSpeed  = MANUAL_SPEED;
  const breathSpeed = 0;

  const ampMax = lsAmp * R * WAVE_SCALE;

  type Strand = { norm: number; yBase: number; envelope: number; phase: number };
  const strands: Strand[] = [];
  for (let li = 0; li < WAVE_COUNT; li++) {
    const norm     = (WAVE_COUNT as number) === 1 ? 0 : (2 * li / (WAVE_COUNT - 1)) - 1;
    const yBase    = norm * R * 0.88;
    const envelope = Math.exp(-norm * norm * 2.8);
    const phase    = li * GOLDEN;
    strands.push({ norm, yBase, envelope, phase });
  }

  // ── Clip ──────────────────────────────────────────────────────────────────────
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.97, 0, Math.PI * 2);
  ctx.clip();

  // ── Pass 1: Glow ──────────────────────────────────────────────────────────────
  if (GLOW_STRENGTH > 0.02) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.filter  = 'blur(2px)';
    ctx.lineCap = 'round';

    const STEPS_G = 60;
    for (const { norm, yBase, envelope, phase } of strands) {
      const pts = buildPts(norm, yBase, envelope, phase, STEPS_G, cx, cy, R, ampMax, lsFreq, mSpeed, breathSpeed, s.time);
      ctx.globalAlpha = envelope * 0.25 * GLOW_STRENGTH;
      ctx.strokeStyle = col(72, 1);
      ctx.lineWidth   = 5;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5;
        const my = (pts[i].y + pts[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  // ── Pass 2: Crisp ─────────────────────────────────────────────────────────────
  {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineCap = 'round';

    const STEPS_C = 120;
    for (const { norm, yBase, envelope, phase } of strands) {
      const pts = buildPts(norm, yBase, envelope, phase, STEPS_C, cx, cy, R, ampMax, lsFreq, mSpeed, breathSpeed, s.time);
      ctx.globalAlpha = envelope * 0.88;
      ctx.strokeStyle = col(75, 1);
      ctx.lineWidth   = 1.1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) * 0.5;
        const my = (pts[i].y + pts[i + 1].y) * 0.5;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  ctx.restore(); // end clip

  // ── Ring ──────────────────────────────────────────────────────────────────────
  const cw = 0.5 + CIRCLE_WEIGHT * 2.4;
  ctx.save();
  ctx.globalAlpha  = 0.90;
  ctx.strokeStyle  = t <= 0
    ? 'rgba(255,255,255,1)'
    : t >= 1
      ? `hsla(${HUE},${SAT}%,68%,1)`
      : `rgba(${Math.round(255-11*t)},${Math.round(255-51*t)},${Math.round(255-132*t)},1)`;
  ctx.lineWidth    = cw;
  ctx.beginPath();
  ctx.arc(cx, cy, R, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function buildPts(
  norm: number, yBase: number, envelope: number, phase: number,
  STEPS: number,
  cx: number, cy: number, R: number,
  ampMax: number, freq: number, mSpeed: number, breathSpeed: number,
  time: number,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];

  for (let i = 0; i <= STEPS; i++) {
    const t_     = i / STEPS;
    const x      = (cx - R) + t_ * (R * 2);
    const dx     = x - cx;
    const availY = Math.sqrt(Math.max(0, R * R - dx * dx)) * 0.97;

    const w1 = Math.sin(freq * Math.PI * 2 * t_         + time * mSpeed * 0.40 + phase);
    const w2 = Math.sin(freq * Math.PI * 2 * t_ * 0.618 + time * mSpeed * 0.22 + phase * 0.5 + 1.0) * 0.55;
    const rawNorm = (w1 + w2) / 1.55;

    const breathRange = 0.65;
    const breathInner = Math.max(0,
      0.5 + 0.5 * Math.sin(t_ * Math.PI * 3.2 + time * breathSpeed * 0.15 + norm * 0.38)
    );
    const breathe = 1.0 + breathRange * (Math.pow(breathInner, 1.4) - 0.5);

    const strandAmp = ampMax * envelope * Math.max(0.1, breathe);
    const totalRaw  = yBase + rawNorm * strandAmp;

    pts.push({ x, y: cy + softClamp(totalRaw, availY) });
  }

  return pts;
}
