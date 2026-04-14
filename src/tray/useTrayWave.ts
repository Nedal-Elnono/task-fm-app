import { useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getAnalyser } from '../sounds/soundEngine';
import { renderTrayFrame, type TrayWaveState } from './circleWaveTrayRenderer';

const SIZE           = 44;
const THRESHOLD      = 10;  // min peak amplitude (0–255) to consider audio active
const HOLD_MS        = 150; // hold after amplitude drops below threshold
const TIME_SCALE     = 24;  // virtual time multiplier

export function useTrayWave() {
  const wasActiveRef = useRef(false);
  const stateRef     = useRef<TrayWaveState>({ time: 0, active: false, amp: 0 });
  const prevTsRef    = useRef(0);
  const lastHighRef  = useRef(-Infinity);
  const rafRef       = useRef<number | null>(null);

  useEffect(() => {
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx2d   = canvas.getContext('2d')!;
    let bins: Uint8Array | null = null;

    const pushIcon = () => {
      const imgData = ctx2d.getImageData(0, 0, SIZE, SIZE);
      const raw     = imgData.data;
      let   binary  = '';
      for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i]);
      invoke('update_tray_icon_rgba', { rgba: btoa(binary), width: SIZE, height: SIZE }).catch(() => {});
    };

    // Push the idle circle-wave frame immediately — replaces the transparent
    // Rust placeholder before any animation frame runs.
    renderTrayFrame(ctx2d, SIZE, SIZE, { time: 0, active: false, amp: 0 });
    pushIcon();

    function frame(ts: number) {
      const dt = prevTsRef.current ? Math.min(50, ts - prevTsRef.current) : 16;
      prevTsRef.current = ts;

      const analyser = getAnalyser();
      if (analyser) {
        if (!bins || bins.length !== analyser.frequencyBinCount) {
          bins = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(bins);
        let peak = 0;
        for (let i = 0; i < bins.length; i++) if (bins[i] > peak) peak = bins[i];
        if (peak > THRESHOLD) lastHighRef.current = performance.now();
      }

      const active = (performance.now() - lastHighRef.current) < HOLD_MS;
      const s = stateRef.current;

      if (!active && wasActiveRef.current) {
        s.active = false;
        s.amp    = 0;
        renderTrayFrame(ctx2d, SIZE, SIZE, s);
        pushIcon();
      }

      wasActiveRef.current = active;

      if (!active) {
        rafRef.current = requestAnimationFrame(frame);
        return;
      }

      s.time  += (dt / 1000) * TIME_SCALE;
      s.active = true;
      s.amp    = 1;

      renderTrayFrame(ctx2d, SIZE, SIZE, s);
      pushIcon();

      rafRef.current = requestAnimationFrame(frame);
    }

    rafRef.current = requestAnimationFrame(frame);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);
}
