import { useEffect, useRef } from 'react';
import { AnimatePresence } from 'framer-motion';
import { useStore } from './store/useStore';
import { TaskList } from './components/TaskList';
import { Settings } from './components/Settings';
import { Archive } from './components/Archive';
import { Trash } from './components/Trash';
import { Onboarding } from './components/Onboarding';
import { playSound, initCustomSounds, initElsisiSounds, initFilePack, onAudioPlay, onAudioStop, refreshAllPacks } from './sounds/soundEngine';
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
    const popup = () => document.querySelector('.popup') as HTMLElement | null;

    const unsubPlay = onAudioPlay(() => {
      popup()?.classList.add('audio-glow');
    });

    // Mod 29: remove glow only when sound actually stops
    const unsubStop = onAudioStop(() => {
      popup()?.classList.remove('audio-glow');
    });

    return () => { unsubPlay(); unsubStop(); };
  }, []);
}


// ─── Squircle clip (Apple continuous corner) ─────────────────────────────────

function squirclePath(w: number, h: number, r: number): string {
  // Derived from Apple's iOS icon formula (reverse-engineered):
  //   influence zone  t = 1.25 × r  (curve starts earlier than a circle)
  //   bezier control  c = 0.5 × t   (gradual curvature ramp-in, not abrupt)
  // This produces the same superellipse-like "continuous corner" used in
  // macOS windows, iOS icons, and Apple's HIG rounded rectangles.
  const t = Math.min(r * 1.25, w / 2, h / 2);
  const c = t * 0.5;
  return (
    `M ${t} 0 L ${w - t} 0 ` +
    `C ${w - c} 0 ${w} ${c} ${w} ${t} ` +
    `L ${w} ${h - t} ` +
    `C ${w} ${h - c} ${w - c} ${h} ${w - t} ${h} ` +
    `L ${t} ${h} ` +
    `C ${c} ${h} 0 ${h - c} 0 ${h - t} ` +
    `L 0 ${t} ` +
    `C 0 ${c} ${c} 0 ${t} 0 Z`
  );
}

function useSquircleClip() {
  useEffect(() => {
    const el = document.querySelector('.popup') as HTMLElement | null;
    if (!el) return;

    const apply = () => {
      const { width, height } = el.getBoundingClientRect();
      if (width === 0 || height === 0) return;
      el.style.clipPath = `path('${squirclePath(width, height, 19)}')`;
      el.style.borderRadius = '0';
    };

    const ro = new ResizeObserver(apply);
    ro.observe(el);
    apply();

    return () => {
      ro.disconnect();
      el.style.clipPath = '';
      el.style.borderRadius = '';
    };
  }, []);
}

// ─── App ──────────────────────────────────────────────────────────────────────


export default function App() {
  const hydrate = useStore((s) => s.hydrate);
  const hydrated = useStore((s) => s.hydrated);
  const view = useStore((s) => s.view);
  const settings = useStore((s) => s.settings);
  const autoArchiveStale = useStore((s) => s.autoArchiveStale);

  useIdleSound();
  useInactivityReminder();
  useAudioGlow();
  useSquircleClip();
  useTrayWave();

  // Live-apply label overrides saved from the Admin Dashboard
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ en: Record<string, string>; ar: Record<string, string> }>(
        'labels-updated',
        (e) => { useStore.getState().updateSettings({ labelOverrides: e.payload }); }
      ).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);

  // Mod 84-85-89 / 97-100: rebuild sound pools when dashboard triggers a rescan
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ packs?: { id: string; name: string }[] }>('sounds-updated', async (e) => {
        const discoveredPacks = await refreshAllPacks();
        // Dashboard sends resolved names in payload; fall back to derived names
        const userPacks = e.payload?.packs
          ? e.payload.packs.filter(p => !['default','crisp','minimal','elsisi','bahgt','elguyar'].includes(p.id))
          : discoveredPacks;
        useStore.getState().setUserPacks(userPacks);
        console.log('[App] sounds-updated — user packs now:', userPacks);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);

  // Load branding on startup + listen for dashboard updates
  useEffect(() => {
    const applyBranding = async (b: { appName?: string; logoPath?: string }) => {
      let logoDataUrl = '';
      if (b.logoPath) {
        try {
          const { invoke } = await import('@tauri-apps/api/core');
          logoDataUrl = await invoke<string>('read_image_as_data_url', { path: b.logoPath });
        } catch {}
      }
      useStore.getState().setBranding({ appName: b.appName || 'TASK FM', logoDataUrl });
    };

    import('@tauri-apps/api/core').then(({ invoke }) => {
      invoke<string>('get_branding').then(json => applyBranding(JSON.parse(json))).catch(() => {});
    });

    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/event').then(({ listen }) => {
      listen<{ appName?: string; logoPath?: string }>('branding-updated', (e) => {
        applyBranding(e.payload);
      }).then((fn) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, []);

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
    <div style={{ width:'100%', height:'100%', paddingTop:0, paddingLeft:10, paddingRight:10, paddingBottom:10, boxSizing:'border-box', background:'transparent' }}>
    <div className="popup">
      <AnimatePresence mode="wait">
        {view === 'onboarding' && <Onboarding key="onboarding" />}
        {view === 'tasks'     && <TaskList   key="tasks" />}
        {view === 'settings'  && <Settings   key="settings" />}
        {view === 'archive'   && <Archive    key="archive" />}
        {view === 'trash'     && <Trash      key="trash" />}
      </AnimatePresence>
    </div>
    </div>
  );
}
