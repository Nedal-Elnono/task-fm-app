import { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import type { Update } from '@tauri-apps/plugin-updater';
import { useStore } from './store/useStore';
import { useT } from './hooks/useT';
import { TaskList } from './components/TaskList';
import { Settings } from './components/Settings';
import { Archive } from './components/Archive';
import { Trash } from './components/Trash';
import { Onboarding } from './components/Onboarding';
import { playSound, initCustomSounds, initElsisiSounds, initFilePack, refreshAllPacks, getAnalyser } from './sounds/soundEngine';
import { useTrayWave } from './tray/useTrayWave';
import './styles/globals.css';

// ─── Idle Sound Hook ──────────────────────────────────────────────────────────

function useIdleSound() {
  const settings = useStore((s) => s.settings);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!settings.soundEnabled || !settings.idleSound.enabled) {
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    const schedule = () => {
      const { frequencyHours, randomize, dayStart, dayEnd } = settings.idleSound;
      const baseMs = frequencyHours * 60 * 60 * 1000;
      const jitter = randomize ? (Math.random() - 0.5) * 60 * 60 * 1000 : 0;
      const delay = Math.max(baseMs + jitter, 60_000);

      timerRef.current = setTimeout(() => {
        const hour = new Date().getHours();
        if (hour >= dayStart && hour < dayEnd) {
          playSound('randomIdle', settings.activeSoundPack, settings.soundVolume);
        }
        schedule();
      }, delay);
    };

    schedule();
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [
    settings.soundEnabled,
    settings.idleSound.enabled,
    settings.idleSound.frequencyHours,
    settings.idleSound.randomize,
    settings.idleSound.dayStart,
    settings.idleSound.dayEnd,
    settings.activeSoundPack,
    settings.soundVolume,
  ]);
}

// ─── Inactivity Reminder Hook ─────────────────────────────────────────────────

function useInactivityReminder() {
  const settings = useStore((s) => s.settings);
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const track = () => { lastActivityRef.current = Date.now(); };
    window.addEventListener('mousemove', track, { passive: true });
    window.addEventListener('keydown', track, { passive: true });
    window.addEventListener('click', track, { passive: true });
    return () => {
      window.removeEventListener('mousemove', track);
      window.removeEventListener('keydown', track);
      window.removeEventListener('click', track);
    };
  }, []);

  useEffect(() => {
    if (!settings.soundEnabled) return;

    const interval = setInterval(() => {
      const idleMs = Date.now() - lastActivityRef.current;
      const thresholdMs = 2 * 60 * 60 * 1000; // 2 hours idle
      if (idleMs > thresholdMs) {
        const hour = new Date().getHours();
        const { dayStart, dayEnd } = settings.idleSound;
        if (hour >= dayStart && hour < dayEnd) {
          playSound('inactivityReminder', settings.activeSoundPack, settings.soundVolume);
          lastActivityRef.current = Date.now(); // reset so it doesn't repeat immediately
        }
      }
    }, 5 * 60 * 1000); // check every 5 minutes

    return () => clearInterval(interval);
  }, [
    settings.soundEnabled,
    settings.idleSound.dayStart,
    settings.idleSound.dayEnd,
    settings.activeSoundPack,
    settings.soundVolume,
  ]);
}

// ─── Audio Glow Effect ────────────────────────────────────────────────────────

function useAudioGlow() {
  useEffect(() => {
    // Same proven pattern as useTrayWave: always-on rAF loop reading the
    // analyser directly — no play/stop event plumbing to go stale.
    let raf = 0;
    let bins: Uint8Array | null = null;
    let level = 0;          // smoothed loudness 0..1
    let lastHigh = -Infinity;
    let t = 0;              // pulse clock (s)
    let prevTs = 0;

    const frame = (ts: number) => {
      const dt = prevTs ? Math.min(50, ts - prevTs) / 1000 : 0.016;
      prevTs = ts;

      let loud = 0;
      const analyser = getAnalyser();
      if (analyser) {
        if (!bins || bins.length !== analyser.frequencyBinCount) {
          bins = new Uint8Array(analyser.frequencyBinCount);
        }
        analyser.getByteFrequencyData(bins);
        let peak = 0;
        let sum = 0;
        for (let i = 0; i < bins.length; i++) {
          const v = bins[i];
          sum += v;
          if (v > peak) peak = v;
        }
        if (peak > 10) lastHigh = performance.now();
        loud = sum / bins.length / 255;
      }

      const active = performance.now() - lastHigh < 150;
      // Floor keeps the ring alive during quiet passages of an active sound
      const target = active ? Math.max(0.35, Math.min(1, loud * 2.2)) : 0;
      // Quick attack, gentle release
      level += (target - level) * (target > level ? 0.35 : 0.08);

      // Breathing pulse rides on top of the audio envelope: the whole ring
      // glows up and down (~1.4 Hz) while sound is active.
      t += dt;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2 * Math.PI * 1.4);
      const glow = level * (0.45 + 0.55 * pulse);

      const popup = document.querySelector('.popup') as HTMLElement | null;
      if (popup) {
        popup.style.setProperty('--glow-o', level < 0.01 ? '0' : Math.min(1, 0.25 + glow * 1.1).toFixed(3));
        popup.style.setProperty('--glow-b', (2 + glow * 12).toFixed(1) + 'px');
      }

      raf = requestAnimationFrame(frame);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
}


// ─── Auto-updater ─────────────────────────────────────────────────────────────

function useUpdater() {
  const [update, setUpdate] = useState<Update | null>(null);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    // Check once on startup; fails silently in dev builds / offline
    import('@tauri-apps/plugin-updater')
      .then(({ check }) => check())
      .then((u) => { if (u) setUpdate(u); })
      .catch(() => {});
  }, []);

  const install = async () => {
    if (!update || installing) return;
    setInstalling(true);
    try {
      await update.downloadAndInstall();
      const { relaunch } = await import('@tauri-apps/plugin-process');
      await relaunch();
    } catch {
      setInstalling(false);
    }
  };

  return { update, installing, install };
}

// ─── App ──────────────────────────────────────────────────────────────────────


export default function App() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const view = useStore((s) => s.view);
  const settings = useStore((s) => s.settings);
  const autoArchiveStale = useStore((s) => s.autoArchiveStale);
  const t = useT();

  useIdleSound();
  useInactivityReminder();
  useAudioGlow();
  useTrayWave();
  const { update, installing, install } = useUpdater();

  useEffect(() => {
    // Mod 49: globally disable media session so keyboard media keys never
    // pause/play app sounds or hijack Spotify/YouTube/etc.
    try {
      if ('mediaSession' in navigator) {
        (navigator as any).mediaSession.metadata = null;
        const noOp = () => {};
        ['play','pause','stop','previoustrack','nexttrack','seekbackward','seekforward'].forEach(a => {
          try { (navigator as any).mediaSession.setActionHandler(a, noOp); } catch { /* ignore */ }
        });
      }
    } catch { /* ignore */ }

    hydrate().then(async () => {
      initCustomSounds();
      initElsisiSounds();
      initFilePack('bahgt');
      initFilePack('elguyar');
      autoArchiveStale();
      // Mod 97-100: discover user packs on startup
      const userPacks = await refreshAllPacks();
      useStore.getState().setUserPacks(userPacks);
    });
  }, []);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (settings.theme === 'system') {
      root.dataset.theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    } else {
      root.dataset.theme = settings.theme;
    }
  }, [settings.theme]);

  // Apply RTL for Arabic
  useEffect(() => {
    document.documentElement.dir = settings.language === 'ar' ? 'rtl' : 'ltr';
  }, [settings.language]);

  // Escape = hide popup
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        import('@tauri-apps/api/core')
          .then(({ invoke }) => invoke('hide_popup').catch(() => {}))
          .catch(() => {});
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!hydrated) {
    return (
      <div className="popup" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>…</div>
      </div>
    );
  }

  return (
    <div className="popup">
      <AnimatePresence mode="wait">
        {view === 'onboarding' && <Onboarding key="onboarding" />}
        {view === 'tasks'     && <TaskList   key="tasks" />}
        {view === 'settings'  && <Settings   key="settings" />}
        {view === 'archive'   && <Archive    key="archive" />}
        {view === 'trash'     && <Trash      key="trash" />}
      </AnimatePresence>

      {update && (
        <div className="update-banner">
          <span className="update-banner-text">
            {t.updateAvailable} <b>v{update.version}</b>
          </span>
          <button className="update-banner-btn" onClick={install} disabled={installing}>
            {installing ? t.updating : t.updateNow}
          </button>
        </div>
      )}
    </div>
  );
}
