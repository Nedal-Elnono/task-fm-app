import { useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';
import { SOUND_PACKS, playSound } from '../sounds/soundEngine';

export function Onboarding() {
  const completeOnboarding = useStore((s) => s.completeOnboarding);
  const t = useT();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark');
  const [pack, setPack] = useState('default');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const handlePackClick = (id: string) => {
    setPack(id);
    if (soundEnabled) playSound('stepCompleted', id, 0.6);
  };

  const handleStart = () => {
    completeOnboarding({
      theme,
      activeSoundPack: pack,
      soundEnabled,
      userName: name.trim() || undefined,
      userEmail: email.trim() || undefined,
    });
  };

  return (
    <motion.div
      className="onboarding"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Brand mark */}
      <div className="onboarding-brand">
        <span className="onboarding-brand-dot" />
        TASK FM
      </div>

      <div className="onboarding-title">{t.onboardingTitle}</div>
      <div className="onboarding-sub">{t.onboardingSub}</div>

      {/* Name */}
      <div className="onboarding-field">
        <div className="onboarding-field-label">{t.yourName}</div>
        <input
          className="onboarding-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={t.namePlaceholder}
          autoComplete="off"
        />
      </div>

      {/* Email */}
      <div className="onboarding-field">
        <div className="onboarding-field-label">{t.yourEmail}</div>
        <input
          className="onboarding-input"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder={t.emailPlaceholder}
          autoComplete="off"
        />
      </div>

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
              className={`pack-chip ${pack === p.id ? 'active' : ''}`}
              onClick={() => handlePackClick(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {/* Theme */}
      <div className="onboarding-section" style={{ marginBottom: 12 }}>
        <div className="onboarding-label">{t.theme}</div>
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

      {/* Enable sounds toggle */}
      <div className="onboarding-toggle-row" style={{ marginBottom: 0 }}>
        <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 450 }}>{t.enableSoundsLabel}</span>
        <button
          className={`toggle ${soundEnabled ? 'on' : ''}`}
          onClick={() => setSoundEnabled(!soundEnabled)}
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
