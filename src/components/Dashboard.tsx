import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useStore } from '../store/useStore';
import {
  SOUND_PACKS, playSound,
  initFilePack, isFilePackInstalled, getFilePackCount,
  FILE_PACK_ZIP_NAMES,
} from '../sounds/soundEngine';
import { translations } from '../i18n';

// ─── String-only translation keys (editable in dashboard) ─────────────────────

type Lang = 'en' | 'ar';

const STRING_KEYS = (Object.entries(translations.en) as [string, unknown][])
  .filter(([, v]) => typeof v === 'string')
  .map(([k]) => k);

// Group keys by section for a cleaner UI
const KEY_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Header / Nav', keys: ['myTasks','settings','archive','trash'] },
  { title: 'Task List', keys: ['tapToAdd','taskNamePlaceholder','newItemPlaceholder','addChecklist'] },
  { title: 'Actions', keys: ['archiveTask','deleteTask','confirmYes','confirmNo','restore','deleteForever','emptyTrash'] },
  { title: 'Archive / Trash', keys: ['archiveTitle','archiveEmpty','trashTitle','trashEmpty'] },
  { title: 'Appearance', keys: ['appearance','theme','themeDark','themeLight','themeSystem','animations'] },
  { title: 'Tasks Settings', keys: ['tasks','autoSortCompleted','autoSortDesc'] },
  { title: 'Sound Settings', keys: ['sound','sounds','volume','taskCreated','itemChecked','taskCompleted','soundPack'] },
  { title: 'Elsisi Pack', keys: ['elsisiPack','elsisiSounds','elsisiReady','elsisiInstall','elsisiInstallDesc','elsisiInstallBtn','elsisiInstalling'] },
  { title: 'Ambient Sound', keys: ['ambientSound','randomIdle','randomIdleDesc','frequency','randomizeTiming','randomizeDesc','activeHours'] },
  { title: 'Custom Sounds', keys: ['customSounds','useCustomSounds','soundsFolder','reloadSounds'] },
  { title: 'System / Language', keys: ['system','launchAtStartup','language'] },
  { title: 'Trash Section', keys: ['trashSection','openTrash'] },
];

// ─── Sound Pack Row ─────────────────────────────────────────────────────────

interface PackRowProps {
  packId: string;
  packName: string;
  isFileBased: boolean;
  volume: number;
  activePack: string;
  onSelect: () => void;
}

function PackRow({ packId, packName, isFileBased, volume, activePack, onSelect }: PackRowProps) {
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState('');
  const [zipPath, setZipPath] = useState('');
  const [count, setCount] = useState(isFileBased ? getFilePackCount(packId) : -1);
  const [installed, setInstalled] = useState(isFileBased ? isFilePackInstalled(packId) : true);
  const [showPathInput, setShowPathInput] = useState(false);

  useEffect(() => {
    if (!isFileBased) return;
    // Pre-fill zip path with Downloads default
    const getDefaultPath = async () => {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        const dir: string = await invoke('get_file_pack_dir', { packId });
        const home = dir.split('/Library/')[0];
        setZipPath(`${home}/Downloads/${FILE_PACK_ZIP_NAMES[packId] ?? packName + '.zip'}`);
      } catch {}
    };
    getDefaultPath();
  }, [packId, isFileBased, packName]);

  const handleInstall = async () => {
    setInstalling(true);
    setError('');
    try {
      const { invoke } = await import('@tauri-apps/api/core');
      await invoke('install_file_pack', { packId, zipPath });
      await initFilePack(packId);
      setCount(getFilePackCount(packId));
      setInstalled(isFilePackInstalled(packId));
    } catch (err: any) {
      setError(String(err));
    }
    setInstalling(false);
  };

  const handleRescan = async () => {
    await initFilePack(packId);
    setCount(getFilePackCount(packId));
    setInstalled(isFilePackInstalled(packId));
  };

  return (
    <div className="dash-pack-row">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)' }}>{packName}</div>
          {isFileBased && (
            <div style={{ fontSize: 10, color: installed ? 'var(--accent)' : 'var(--text3)', marginTop: 2 }}>
              {installed ? `✓ ${count} files` : 'Not installed'}
            </div>
          )}
          {!isFileBased && (
            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>Built-in</div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {!isFileBased && (
            <button className="dash-btn"
              onClick={() => { onSelect(); playSound('stepCompleted', packId, volume); }}>
              Preview
            </button>
          )}
          {isFileBased && installed && (
            <>
              <button className="dash-btn" onClick={handleRescan}>Rescan</button>
              <button className="dash-btn" onClick={() => setShowPathInput(v => !v)}>Reinstall</button>
            </>
          )}
          {isFileBased && !installed && (
            <button className="dash-btn accent" onClick={() => setShowPathInput(v => !v)}>Install</button>
          )}
          <button
            className={`dash-btn ${activePack === packId ? 'active' : ''}`}
            onClick={onSelect}
          >
            {activePack === packId ? '✓ Active' : 'Use'}
          </button>
        </div>
      </div>
      {isFileBased && showPathInput && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>ZIP path:</div>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="dash-input"
              value={zipPath}
              onChange={(e) => setZipPath(e.target.value)}
              placeholder="Path to .zip file"
            />
            <button className="dash-btn accent" onClick={handleInstall} disabled={installing}>
              {installing ? '…' : 'Install'}
            </button>
          </div>
          {error && <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 4, wordBreak: 'break-all' }}>{error}</div>}
        </div>
      )}
    </div>
  );
}

// ─── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const settings = useStore((s) => s.settings);
  const update = useStore((s) => s.updateSettings);
  const setView = useStore((s) => s.setView);

  const [tab, setTab] = useState<'sounds' | 'labels'>('sounds');
  const [labelLang, setLabelLang] = useState<Lang>('en');

  const overrides = settings.labelOverrides?.[labelLang] ?? {};

  const setOverride = (key: string, value: string) => {
    const defaults = translations[labelLang] as Record<string, unknown>;
    const current = settings.labelOverrides?.[labelLang] ?? {};
    // If value matches default, remove the override
    if (value === defaults[key]) {
      const next = { ...current };
      delete next[key];
      update({ labelOverrides: { ...settings.labelOverrides, [labelLang]: next } });
    } else {
      update({ labelOverrides: { ...settings.labelOverrides, [labelLang]: { ...current, [key]: value } } });
    }
  };

  const resetAll = () => {
    update({ labelOverrides: { ...settings.labelOverrides, [labelLang]: {} } });
  };

  const FILE_PACK_SET = new Set(['elsisi', 'bahgt', 'elguyar']);

  return (
    <motion.div
      className="view"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="header" data-tauri-drag-region>
        <button className="detail-back" onClick={() => setView('settings')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-title small" style={{ flex: 1, marginLeft: 10 }} data-tauri-drag-region>
          Dashboard
        </div>
      </div>

      {/* Tab bar */}
      <div className="dash-tabs">
        <button className={`dash-tab ${tab === 'sounds' ? 'active' : ''}`} onClick={() => setTab('sounds')}>
          Sounds
        </button>
        <button className={`dash-tab ${tab === 'labels' ? 'active' : ''}`} onClick={() => setTab('labels')}>
          Labels
        </button>
      </div>

      <div className="settings-scroll" style={{ paddingTop: 8 }}>

        {/* ── Sounds Tab ── */}
        {tab === 'sounds' && (
          <>
            <div className="settings-section-title">Sound Packs</div>
            <div className="settings-section" style={{ padding: 0 }}>
              {SOUND_PACKS.map((p) => (
                <PackRow
                  key={p.id}
                  packId={p.id}
                  packName={p.name}
                  isFileBased={FILE_PACK_SET.has(p.id)}
                  volume={settings.soundVolume}
                  activePack={settings.activeSoundPack}
                  onSelect={() => update({ activeSoundPack: p.id })}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Labels Tab ── */}
        {tab === 'labels' && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 0 8px' }}>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['en', 'ar'] as Lang[]).map(lang => (
                  <button
                    key={lang}
                    className={`dash-tab ${labelLang === lang ? 'active' : ''}`}
                    style={{ fontSize: 11, padding: '3px 10px' }}
                    onClick={() => setLabelLang(lang)}
                  >
                    {lang === 'en' ? 'English' : 'العربية'}
                  </button>
                ))}
              </div>
              {Object.keys(overrides).length > 0 && (
                <button className="dash-btn" style={{ fontSize: 10 }} onClick={resetAll}>
                  Reset all
                </button>
              )}
            </div>

            {KEY_GROUPS.map((group) => (
              <div key={group.title}>
                <div className="settings-section-title" style={{ marginBottom: 4 }}>{group.title}</div>
                <div className="settings-section" style={{ padding: 0 }}>
                  {group.keys.filter(k => STRING_KEYS.includes(k)).map((key) => {
                    const defaultVal = (translations[labelLang] as Record<string, unknown>)[key] as string ?? '';
                    const currentVal = overrides[key] ?? defaultVal;
                    const isOverridden = key in overrides;
                    return (
                      <div key={key} className="dash-label-row">
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                          <span style={{ fontSize: 9, color: 'var(--text3)', fontFamily: 'monospace' }}>{key}</span>
                          {isOverridden && (
                            <button
                              style={{ fontSize: 9, color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                              onClick={() => setOverride(key, defaultVal)}
                            >↩ reset</button>
                          )}
                        </div>
                        <input
                          className={`dash-input ${isOverridden ? 'overridden' : ''}`}
                          value={currentVal}
                          dir={labelLang === 'ar' ? 'rtl' : 'ltr'}
                          onChange={(e) => setOverride(key, e.target.value)}
                          placeholder={defaultVal}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

      </div>
    </motion.div>
  );
}
