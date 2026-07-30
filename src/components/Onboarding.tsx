import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';
import { SOUND_PACKS, playSound } from '../sounds/soundEngine';
import elsisiIcon from '../assets/packs/elsisi.png';
import bahgtIcon from '../assets/packs/bahgt.png';
import elguyarIcon from '../assets/packs/elguyar.png';

const PACK_ICONS: Record<string, string> = {
  elsisi: elsisiIcon,
  bahgt: bahgtIcon,
  elguyar: elguyarIcon,
};

export function Onboarding() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const idleSoundDefaults = useStore((s) => s.settings.idleSound);
  const t = useT();

  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [pack, setPack] = useState('default');
  const [ambientEnabled, setAmbientEnabled] = useState(true);

  // Live preview: apply the picked theme immediately so the user sees it
  // before committing with "Get Started"
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        : theme;
  }, [theme]);

  const handlePackClick = (id: string) => {
    setPack(id);
    playSound('stepCompleted', id, 0.6);
  };

  const handleStart = () => {
    completeOnboarding({
      theme,
      activeSoundPack: pack,
      idleSound: { ...idleSoundDefaults, enabled: ambientEnabled },
    });
  };

  return (
    <motion.div
      className="onboarding"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Full-width drag strip across the window top — same feel as the main header */}
      <div
        data-tauri-drag-region
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 56, zIndex: 5 }}
      />

      {/* Brand mark */}
      <div className="onboarding-brand" data-tauri-drag-region>
        <span className="onboarding-brand-dot" data-tauri-drag-region />
        TASK FM
      </div>

      <div className="onboarding-title" data-tauri-drag-region>{t.onboardingTitle}</div>
      <div className="onboarding-sub" data-tauri-drag-region>{t.onboardingSub}</div>

      {/* Sound Pack */}
      <div className="onboarding-section">
        <div className="onboarding-label-row">
          <span className="onboarding-label">{t.pickYourSound}</span>
          <span className="onboarding-hint">{t.tapToPreview}</span>
        </div>
        <div className="onboarding-pack-grid">
          {SOUND_PACKS.map((p) => (
            <button
              key={p.id}
              className={`pack-chip ${pack === p.id ? 'active' : ''} ${p.id === 'shuffle' ? 'span-full' : ''}`}
              onClick={() => handlePackClick(p.id)}
              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            >
              {PACK_ICONS[p.id] && (
                <img
                  src={PACK_ICONS[p.id]}
                  alt=""
                  style={{ width: 16, height: 16, objectFit: 'contain', flexShrink: 0 }}
                />
              )}
              {p.id === 'shuffle' && (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                  <path d="M2 17c5 0 6-2.5 8.5-5C13 9.5 14 7 19 7M2 7c5 0 6 2.5 8.5 5 2.5 2.5 3.5 5 8.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M16.5 4L20 7l-3.5 3M16.5 14l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="onboarding-section" style={{ marginBottom: 12 }}>
        <div className="onboarding-label-row">
          <span className="onboarding-label">{t.theme}</span>
        </div>
        <div className="theme-options">
          {(['dark', 'light', 'system'] as const).map((th) => (
            <button
              key={th}
              className={`theme-chip ${theme === th ? 'active' : ''}`}
              onClick={() => setTheme(th)}
            >
              {th === 'dark' ? t.themeDark : th === 'light' ? t.themeLight : t.themeSystem}
            </button>
          ))}
        </div>
      </div>

      {/* Ambient sounds toggle — do idle sounds play on their own? */}
      <div className="onboarding-toggle-row" style={{ marginBottom: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 450 }}>{t.ambientSoundsLabel}</span>
        <button
          className={`toggle ${ambientEnabled ? 'on' : ''}`}
          onClick={() => setAmbientEnabled(!ambientEnabled)}
        />
      </div>

      <div className="onboarding-actions">
        <button className="submit-btn" onClick={handleStart}>
          {t.getStarted}
        </button>
      </div>
    </motion.div>
  );
}
