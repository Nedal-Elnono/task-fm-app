import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';
import { SOUND_PACKS, playSound } from '../sounds/soundEngine';


export function Settings() {
  const [appVersion, setAppVersion] = useState('');
  useEffect(() => {
    import('@tauri-apps/api/app')
      .then(({ getVersion }) => getVersion())
      .then(setAppVersion)
      .catch(() => {});
  }, []);
  const settings = useStore((s) => s.settings);
  const tasks = useStore((s) => s.tasks);
  const update = useStore((s) => s.updateSettings);
  const setView = useStore((s) => s.setView);
  const logout = useStore((s) => s.logout);
  const branding = useStore((s) => s.branding);
  const userPacks = useStore((s) => s.userPacks);
  const t = useT();

  const freqPresets = [
    { label: t.freqMany,   sub: '1h', value: 1 },
    { label: t.freqNormal, sub: '3h', value: 3 },
    { label: t.freqFew,    sub: '6h', value: 6 },
  ];

  const trashCount = tasks.filter((task) => task.trashed).length;


  const toggle = (key: keyof typeof settings) =>
    update({ [key]: !settings[key] } as any);

  const toggleEvent = (event: 'taskCreated' | 'stepCompleted' | 'taskCompleted') =>
    update({ soundEvents: { ...settings.soundEvents, [event]: !settings.soundEvents[event] } });

  const updateIdle = (key: string, value: any) =>
    update({ idleSound: { ...settings.idleSound, [key]: value } });


  return (
    <motion.div
      className="view"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="header" data-tauri-drag-region>
        <button className="detail-back" onClick={() => setView('tasks')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-title small" style={{ flex: 1, marginLeft: 10 }}>{t.settings}</div>
      </div>

      <div className="settings-scroll">

        {/* Appearance */}
        <div className="settings-section-title">{t.appearance}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-label">{t.theme}</div>
            <select className="settings-select" value={settings.theme}
              onChange={(e) => update({ theme: e.target.value as any })}>
              <option value="dark">{t.themeDark}</option>
              <option value="light">{t.themeLight}</option>
              <option value="system">{t.themeSystem}</option>
            </select>
          </div>
          <div className="settings-row">
            <div className="settings-row-label">{t.animations}</div>
            <button className={`toggle ${settings.animationsEnabled ? 'on' : ''}`}
              onClick={() => toggle('animationsEnabled')} />
          </div>
        </div>

        {/* Tasks */}
        <div className="settings-section-title">{t.tasks}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">{t.autoSortCompleted}</div>
              <div className="settings-row-desc">{t.autoSortDesc}</div>
            </div>
            <button className={`toggle ${settings.autoSortCompleted ? 'on' : ''}`}
              onClick={() => toggle('autoSortCompleted')} />
          </div>
        </div>

        {/* Sound */}
        <div className="settings-section-title">{t.sound}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-label">{t.sounds}</div>
            <button className={`toggle ${settings.soundEnabled ? 'on' : ''}`}
              onClick={() => toggle('soundEnabled')} />
          </div>
          {settings.soundEnabled && <>
            <div className="settings-row">
              <div className="settings-row-label">{t.volume}</div>
              <input type="range" className="settings-slider" min={0} max={1} step={0.05}
                value={settings.soundVolume}
                onChange={(e) => update({ soundVolume: parseFloat(e.target.value) })}
                onMouseUp={() => playSound('stepCompleted', settings.activeSoundPack, settings.soundVolume)} />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">{t.taskCreated}</div>
              <button className={`toggle ${settings.soundEvents.taskCreated ? 'on' : ''}`}
                onClick={() => toggleEvent('taskCreated')} />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">{t.itemChecked}</div>
              <button className={`toggle ${settings.soundEvents.stepCompleted ? 'on' : ''}`}
                onClick={() => toggleEvent('stepCompleted')} />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">{t.taskCompleted}</div>
              <button className={`toggle ${settings.soundEvents.taskCompleted ? 'on' : ''}`}
                onClick={() => toggleEvent('taskCompleted')} />
            </div>
          </>}
        </div>

        {/* Sound Pack */}
        {settings.soundEnabled && <>
          <div className="settings-section-title">{t.soundPack}</div>
          <div className="pack-options">
            {SOUND_PACKS.map((p) => (
              <button key={p.id}
                className={`pack-chip ${settings.activeSoundPack === p.id ? 'active' : ''} ${p.id === 'shuffle' ? 'span-full' : ''}`}
                style={p.id === 'shuffle' ? { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 } : undefined}
                onClick={() => update({ activeSoundPack: p.id })}>
                {p.id === 'shuffle' && (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M2 17c5 0 6-2.5 8.5-5C13 9.5 14 7 19 7M2 7c5 0 6 2.5 8.5 5 2.5 2.5 3.5 5 8.5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    <path d="M16.5 4L20 7l-3.5 3M16.5 14l3.5 3-3.5 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
                {p.name}
              </button>
            ))}
            {userPacks.map((p) => (
              <button key={p.id}
                className={`pack-chip ${settings.activeSoundPack === p.id ? 'active' : ''}`}
                onClick={() => update({ activeSoundPack: p.id })}>
                {p.name}
              </button>
            ))}
          </div>
        </>}

        {/* Idle / Ambient Sound */}
        <div className="settings-section-title">{t.ambientSound}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">{t.randomIdle}</div>
              <div className="settings-row-desc">{t.randomIdleDesc}</div>
            </div>
            <button className={`toggle ${settings.idleSound.enabled ? 'on' : ''}`}
              onClick={() => updateIdle('enabled', !settings.idleSound.enabled)} />
          </div>
          {settings.idleSound.enabled && <>
            <div className="settings-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 8 }}>
              <div className="settings-row-label">{t.frequency}</div>
              <div className="freq-presets">
                {freqPresets.map(p => (
                  <button
                    key={p.value}
                    className={`freq-chip ${settings.idleSound.frequencyHours === p.value ? 'active' : ''}`}
                    onClick={() => updateIdle('frequencyHours', p.value)}
                  >
                    <span className="freq-chip-ar">{p.label}</span>
                    <span className="freq-chip-sub">{p.sub}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="settings-row">
              <div className="settings-row-left">
                <div className="settings-row-label">{t.randomizeTiming}</div>
                <div className="settings-row-desc">{t.randomizeDesc}</div>
              </div>
              <button className={`toggle ${settings.idleSound.randomize ? 'on' : ''}`}
                onClick={() => updateIdle('randomize', !settings.idleSound.randomize)} />
            </div>
            <div className="settings-row">
              <div className="settings-row-label">{t.activeHours}</div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <select className="settings-select" value={settings.idleSound.dayStart}
                  onChange={(e) => updateIdle('dayStart', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>–</span>
                <select className="settings-select" value={settings.idleSound.dayEnd}
                  onChange={(e) => updateIdle('dayEnd', Number(e.target.value))}>
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>{i}:00</option>
                  ))}
                </select>
              </div>
            </div>
          </>}
        </div>

        {/* System */}
        <div className="settings-section-title">{t.system}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-label">{t.launchAtStartup}</div>
            <button className={`toggle ${settings.launchAtStartup ? 'on' : ''}`}
              onClick={() => toggle('launchAtStartup')} />
          </div>
        </div>

        {/* Language */}
        <div className="settings-section-title">{t.language}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-label">{t.language}</div>
            <select className="settings-select" value={settings.language}
              onChange={(e) => update({ language: e.target.value })}>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </div>
        </div>

        {/* Trash */}
        <div className="settings-section-title">{t.trashSection}</div>
        <div className="settings-section">
          <div className="settings-row">
            <div className="settings-row-left">
              <div className="settings-row-label">{t.openTrash}</div>
              <div className="settings-row-desc">{t.trashDesc(trashCount)}</div>
            </div>
            <button className="archive-action-btn" onClick={() => setView('trash')} title={t.openTrash}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <div style={{ padding: '8px 14px 4px' }}>
          <button
            onClick={logout}
            style={{
              width: '100%',
              padding: '10px',
              borderRadius: 10,
              background: 'transparent',
              border: '1px solid var(--border)',
              color: 'var(--danger)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
              fontFamily: 'var(--font)',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(224,80,80,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            {t.logout}
          </button>
        </div>

        <div style={{ textAlign: 'center', padding: '8px 0 8px', color: 'var(--text3)', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          {branding.logoDataUrl
            ? <img src={branding.logoDataUrl} style={{ height: 24, objectFit: 'contain', display: 'block', margin: '0 auto' }} />
            : branding.appName}
          <span style={{ fontSize: 10, opacity: 0.6, letterSpacing: '0.02em' }}>{appVersion}</span>
        </div>
      </div>
    </motion.div>
  );
}
