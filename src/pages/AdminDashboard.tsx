import { useState, useEffect, useCallback, useRef } from 'react';
import { translations } from '../i18n';
import {
  SOUND_PACKS, initFilePack, getFilePackCount, isFilePackInstalled,
  FILE_PACK_ZIP_NAMES,
} from '../sounds/soundEngine';

// ─── Types ────────────────────────────────────────────────────────────────────

type Lang = 'en' | 'ar';

interface LabelOverrides {
  en: Record<string, string>;
  ar: Record<string, string>;
}

interface PackMeta {
  id: string;
  name: string;
  fileBased: boolean;
  installed: boolean;
  total: number;
  eventCounts: Record<string, number>;
}


const ALL_EVENTS = [
  'taskCreated','stepCompleted','taskCompleted',
  'stepDeleted','taskDeleted','randomIdle',
  'inactivityReminder','taskHasManyChecklistItems',
];

const STRING_KEYS = (Object.entries(translations.en) as [string, unknown][])
  .filter(([, v]) => typeof v === 'string')
  .map(([k]) => k);

const KEY_GROUPS: { title: string; keys: string[] }[] = [
  { title: 'Header / Nav',       keys: ['myTasks','settings','archive','trash'] },
  { title: 'Task List',          keys: ['tapToAdd','taskNamePlaceholder','newItemPlaceholder','addChecklist'] },
  { title: 'Actions',            keys: ['archiveTask','deleteTask','confirmYes','confirmNo','restore','deleteForever','emptyTrash'] },
  { title: 'Archive / Trash',    keys: ['archiveTitle','archiveEmpty','trashTitle','trashEmpty'] },
  { title: 'Appearance',         keys: ['appearance','theme','themeDark','themeLight','themeSystem','animations'] },
  { title: 'Tasks Settings',     keys: ['tasks','autoSortCompleted','autoSortDesc'] },
  { title: 'Sound Settings',     keys: ['sound','sounds','volume','taskCreated','itemChecked','taskCompleted','soundPack'] },
  { title: 'Elsisi Pack',        keys: ['elsisiPack','elsisiSounds','elsisiReady','elsisiInstall','elsisiInstallDesc','elsisiInstallBtn','elsisiInstalling'] },
  { title: 'Ambient Sound',      keys: ['ambientSound','randomIdle','randomIdleDesc','frequency','randomizeTiming','randomizeDesc','activeHours'] },
  { title: 'Custom Sounds',      keys: ['customSounds','useCustomSounds','soundsFolder','reloadSounds'] },
  { title: 'System / Language',  keys: ['system','launchAtStartup','language'] },
  { title: 'Trash Section',      keys: ['trashSection','openTrash'] },
];

// ─── invoke helper ───────────────────────────────────────────────────────────

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke: tauriInvoke } = await import('@tauri-apps/api/core');
  return tauriInvoke<T>(cmd, args);
}

// ─── Sounds Section (Mod 62-75) ──────────────────────────────────────────────

const AUDIO_EXTS  = ['.mp3', '.wav', '.m4a', '.aac', '.ogg', '.mp4'];
const KNOWN_PACKS = new Set(['elsisi', 'bahgt', 'elguyar']);
const LS_NAMES    = 'd_packNames';
const LS_ENABLED  = 'd_packEnabled';

function fileName(path: string) { return path.split('/').pop() ?? path; }

function packDisplayName(id: string, knownName?: string, overrides?: Record<string, string>): string {
  if (overrides?.[id]) return overrides[id];
  if (knownName) return knownName;
  return id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ');
}

function loadLS<T>(key: string, fallback: T): T {
  try { return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback; } catch { return fallback; }
}
function saveLS(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

function SoundsSection() {
  // ── packs
  const [packs, setPacks]           = useState<PackMeta[]>([]);
  const [selectedPack, setSelected] = useState<string | null>(null);

  // ── pack name/enabled overrides (localStorage)
  const [packNames, setPackNames]     = useState<Record<string, string>>(() => loadLS(LS_NAMES, {}));
  const [packEnabled, setPackEnabled] = useState<Record<string, boolean>>(() => loadLS(LS_ENABLED, {}));

  // ── pack tab management
  const [renamingPack, setRenamingPack] = useState<string | null>(null);
  const [renameDraft, setRenameDraft]   = useState('');
  const [confirmDel, setConfirmDel]     = useState<string | null>(null);
  const renameInputRef                  = useRef<HTMLInputElement>(null);

  // ── category files
  const [catFiles, setCatFiles]     = useState<Record<string, string[]>>({});
  const [catLoading, setCatLoading] = useState(false);

  // ── drag-drop
  const [dragOver, setDragOver]     = useState<string | null>(null);
  const dragOverRef                 = useRef<{ packId: string; event: string } | null>(null);
  const [dropping, setDropping]     = useState<Record<string, boolean>>({});

  // ── browse fallback
  const [browsePath, setBrowsePath] = useState<Record<string, string>>({});
  const [browseErr, setBrowseErr]   = useState<Record<string, string>>({});

  // ── accordion — only one category open at a time
  const [openCat, setOpenCat]       = useState<string | null>(null);

  // ── file management
  const [deleting, setDeleting]     = useState<string | null>(null);

  // ── file picker (Mod 83)
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const fileInputTarget = useRef<{ packId: string; event: string } | null>(null);

  // ── install / reinstall
  const [zipPaths, setZipPaths]     = useState<Record<string, string>>({});
  const [installing, setInstalling] = useState<Record<string, boolean>>({});
  const [instErr, setInstErr]       = useState<Record<string, string>>({});
  const [showInstall, setShowInst]  = useState<string | null>(null);

  // ── create new pack
  const [showCreate, setShowCreate] = useState(false);
  const [newPackId, setNewPackId]   = useState('');
  const [creating, setCreating]     = useState(false);
  const [createErr, setCreateErr]   = useState('');

  // ── import from ZIP
  const [showImport, setShowImport] = useState(false);
  const [importId, setImportId]     = useState('');
  const [importZip, setImportZip]   = useState('');
  const [importing, setImporting]   = useState(false);
  const [importErr, setImportErr]   = useState('');

  // ── helpers
  const getPackName = (id: string, fallback: string) => packNames[id] ?? fallback;
  const isEnabled   = (id: string) => packEnabled[id] !== false; // default: enabled

  const setPackName = (id: string, name: string) => {
    const next = { ...packNames, [id]: name };
    setPackNames(next); saveLS(LS_NAMES, next);
  };
  const toggleEnabled = (id: string) => {
    const next = { ...packEnabled, [id]: !isEnabled(id) };
    setPackEnabled(next); saveLS(LS_ENABLED, next);
  };

  // ── load category files
  const loadCats = useCallback(async (packId: string) => {
    setCatLoading(true);
    const data: Record<string, string[]> = {};
    await Promise.all(ALL_EVENTS.map(async (ev) => {
      try {
        const files = await invoke<string[]>('scan_file_pack_files', { packId, event: ev });
        data[ev] = files.filter(f => !f.includes('/._'));
      } catch { data[ev] = []; }
    }));
    setCatFiles(data); setCatLoading(false);
  }, []);

  // ── refresh pack list
  const refresh = useCallback(async () => {
    await Promise.all(Array.from(KNOWN_PACKS).map(id => initFilePack(id)));
    const diskIds: string[] = await invoke<string[]>('list_sound_packs').catch(() => []);

    const knownMeta: PackMeta[] = SOUND_PACKS.map(p => ({
      id: p.id, name: p.name,
      fileBased: KNOWN_PACKS.has(p.id),
      installed: KNOWN_PACKS.has(p.id) ? isFilePackInstalled(p.id) : true,
      total: KNOWN_PACKS.has(p.id) ? getFilePackCount(p.id) : -1,
      eventCounts: {},
    }));
    const knownIds = new Set(knownMeta.map(p => p.id));

    const userPacks: PackMeta[] = diskIds
      .filter(id => !knownIds.has(id))
      .map(id => ({ id, name: packDisplayName(id), fileBased: true, installed: true, total: -1, eventCounts: {} }));

    const allPacks = [...knownMeta, ...userPacks];
    setPacks(allPacks);

    const paths: Record<string, string> = {};
    for (const id of KNOWN_PACKS) {
      try {
        const dir  = await invoke<string>('get_file_pack_dir', { packId: id });
        const home = dir.split('/Library/')[0];
        paths[id]  = `${home}/Downloads/${FILE_PACK_ZIP_NAMES[id] ?? id + '.zip'}`;
      } catch {}
    }
    setZipPaths(paths);
    setSelected(prev => {
      if (prev && allPacks.some(p => p.id === prev)) return prev;
      return allPacks.find(p => p.fileBased && p.installed)?.id ?? null;
    });
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { if (selectedPack) loadCats(selectedPack); }, [selectedPack, loadCats]);

  // ── Tauri OS drag-drop
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    import('@tauri-apps/api/window').then(({ getCurrentWindow }) => {
      getCurrentWindow().onDragDropEvent(async (ev: any) => {
        const p = ev.payload;
        if (p.type === 'drop') {
          const target = dragOverRef.current;
          if (!target) return;
          const audioPaths: string[] = (p.paths ?? []).filter((f: string) =>
            AUDIO_EXTS.some(ext => f.toLowerCase().endsWith(ext))
          );
          if (!audioPaths.length) { setDragOver(null); dragOverRef.current = null; return; }
          setDropping(d => ({ ...d, [target.event]: true }));
          for (const srcPath of audioPaths) {
            try { await invoke('add_sound_to_category', { packId: target.packId, event: target.event, srcPath }); } catch {}
          }
          setDropping(d => ({ ...d, [target.event]: false }));
          setDragOver(null); dragOverRef.current = null;
          await loadCats(target.packId);
        } else if (p.type === 'leave') {
          setDragOver(null); dragOverRef.current = null;
        }
      }).then((fn: () => void) => { unlisten = fn; });
    });
    return () => { unlisten?.(); };
  }, [loadCats]);

  const handlePlay = async (filePath: string) => {
    try { const url = await invoke<string>('read_sound_as_data_url', { path: filePath }); new Audio(url).play(); } catch {}
  };

  const handleDeleteFile = async (packId: string, _ev: string, filePath: string) => {
    setDeleting(filePath);
    try { await invoke('remove_sound_from_category', { filePath }); await loadCats(packId); } catch {}
    setDeleting(null);
  };

  const handleBrowseAdd = async (packId: string, ev: string) => {
    const path = (browsePath[ev] ?? '').trim();
    if (!path) { setBrowseErr(e => ({ ...e, [ev]: 'Enter a path' })); return; }
    setBrowseErr(e => ({ ...e, [ev]: '' }));
    try {
      await invoke('add_sound_to_category', { packId, event: ev, srcPath: path });
      setBrowsePath(p => ({ ...p, [ev]: '' }));
      await loadCats(packId);
    } catch (err: any) { setBrowseErr(e => ({ ...e, [ev]: String(err) })); }
  };

  const handleFileInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const target = fileInputTarget.current;
    if (!target) return;
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    const audio = files.filter(f => AUDIO_EXTS.some(ext => f.name.toLowerCase().endsWith(ext)));
    if (!audio.length) return;
    setDropping(d => ({ ...d, [target.event]: true }));
    for (const file of audio) {
      const filePath = (file as any).path as string | undefined;
      if (filePath) {
        try { await invoke('add_sound_to_category', { packId: target.packId, event: target.event, srcPath: filePath }); } catch {}
      } else {
        try {
          const buf  = await file.arrayBuffer();
          const bytes = Array.from(new Uint8Array(buf));
          await invoke('add_sound_bytes_to_category', { packId: target.packId, event: target.event, fileName: file.name, bytes });
        } catch {}
      }
    }
    setDropping(d => ({ ...d, [target.event]: false }));
    await loadCats(target.packId);
  };

  const handleInstall = async (packId: string) => {
    setInstalling(i => ({ ...i, [packId]: true })); setInstErr(e => ({ ...e, [packId]: '' }));
    try { await invoke('install_file_pack', { packId, zipPath: zipPaths[packId] ?? '' }); await refresh(); setShowInst(null); }
    catch (err: any) { setInstErr(e => ({ ...e, [packId]: String(err) })); }
    setInstalling(i => ({ ...i, [packId]: false }));
  };

  const handleCreatePack = async () => {
    const id = newPackId.trim().toLowerCase().replace(/\s+/g, '-');
    if (!id) { setCreateErr('Enter a name'); return; }
    setCreating(true); setCreateErr('');
    try {
      await invoke('create_sound_pack', { packId: id });
      if (newPackId.trim() !== id) setPackName(id, newPackId.trim());
      setNewPackId(''); setShowCreate(false);
      await refresh(); setSelected(id);
    } catch (err: any) { setCreateErr(String(err)); }
    setCreating(false);
  };

  const handleImport = async () => {
    if (!importId.trim()) { setImportErr('Pack ID required'); return; }
    setImporting(true); setImportErr('');
    try {
      await invoke('install_file_pack', { packId: importId.trim(), zipPath: importZip.trim() });
      setImportId(''); setImportZip(''); setShowImport(false); await refresh();
    } catch (err: any) { setImportErr(String(err)); }
    setImporting(false);
  };

  const handleDeletePack = async (packId: string) => {
    try {
      await invoke('delete_sound_pack', { packId });
      if (selectedPack === packId) setSelected(null);
      await refresh();
    } catch {}
    setConfirmDel(null);
  };

  const startRename = (pack: PackMeta) => {
    setRenamingPack(pack.id);
    setRenameDraft(getPackName(pack.id, pack.name));
    setTimeout(() => renameInputRef.current?.select(), 0);
  };

  const commitRename = () => {
    if (renamingPack && renameDraft.trim()) setPackName(renamingPack, renameDraft.trim());
    setRenamingPack(null);
  };

  const selectedMeta = packs.find(p => p.id === selectedPack);
  const filePacks    = packs.filter(p => p.fileBased);

  return (
    <div className="d-section">

      {/* Hidden file input for "+" button (Mod 83) */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".mp3,.wav,.m4a,.aac,.ogg,.mp4"
        multiple
        style={{ display: 'none' }}
        onChange={handleFileInput}
      />

      {/* ── Header */}
      <div className="d-section-header">
        <h2>Sound Packs</h2>
        <div style={{ display: 'flex', gap: 6 }}>
          <button className="d-btn-sm" onClick={async () => {
            await refresh();
            try {
              const { emit } = await import('@tauri-apps/api/event');
              // Send resolved pack names so the app can display them correctly
              const packPayload = packs
                .filter(p => p.fileBased && p.installed)
                .map(p => ({ id: p.id, name: getPackName(p.id, p.name) }));
              await emit('sounds-updated', { packs: packPayload });
            } catch {}
          }}>↺ Rescan</button>
          <button className="d-btn-sm" onClick={() => { setShowImport(false); setShowCreate(s => !s); }}>
            {showCreate ? 'Cancel' : '+ New pack'}
          </button>
          <button className="d-btn-sm" onClick={() => { setShowCreate(false); setShowImport(s => !s); }}>
            {showImport ? 'Cancel' : '↓ Import ZIP'}
          </button>
        </div>
      </div>

      {/* ── Create panel */}
      {showCreate && (
        <div className="d-action-bar">
          <span className="d-action-label">Name</span>
          <input className="d-input" style={{ flex: 1 }} value={newPackId}
            onChange={e => setNewPackId(e.target.value)} placeholder="e.g. Ahmed Mekky" autoFocus
            onKeyDown={e => { if (e.key === 'Enter') handleCreatePack(); if (e.key === 'Escape') setShowCreate(false); }} />
          <button className="d-btn accent" onClick={handleCreatePack} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </button>
          {createErr && <span className="d-err-inline">{createErr}</span>}
        </div>
      )}

      {/* ── Import panel */}
      {showImport && (
        <div className="d-action-bar">
          <input className="d-input" style={{ flex: '0 0 100px' }} value={importId}
            onChange={e => setImportId(e.target.value)} placeholder="pack-id" />
          <input className="d-input" style={{ flex: 1 }} value={importZip}
            onChange={e => setImportZip(e.target.value)} placeholder="/path/to/pack.zip" />
          <button className="d-btn accent" onClick={handleImport} disabled={importing}>
            {importing ? '…' : 'Import'}
          </button>
          {importErr && <span className="d-err-inline">{importErr}</span>}
        </div>
      )}

      {/* ── Pack tabs with management */}
      <div className="d-pack-tabs">
        {filePacks.map(pack => {
          const displayName   = getPackName(pack.id, pack.name);
          const enabled       = isEnabled(pack.id);
          const isSelected    = selectedPack === pack.id;
          const isRenaming    = renamingPack === pack.id;
          const isConfirmDel  = confirmDel === pack.id;
          return (
            <div
              key={pack.id}
              className={`d-pack-tab-wrap ${isSelected ? 'active' : ''} ${!enabled ? 'disabled' : ''}`}
              onClick={() => { if (!isRenaming) setSelected(pack.id); }}
            >
              {/* Name — double-click to rename */}
              {isRenaming ? (
                <input
                  ref={renameInputRef}
                  className="d-tab-rename-input"
                  value={renameDraft}
                  onChange={e => setRenameDraft(e.target.value)}
                  onBlur={commitRename}
                  onKeyDown={e => {
                    if (e.key === 'Enter') commitRename();
                    if (e.key === 'Escape') setRenamingPack(null);
                    e.stopPropagation();
                  }}
                  onClick={e => e.stopPropagation()}
                  autoFocus
                />
              ) : (
                <span className="d-tab-name" onDoubleClick={e => { e.stopPropagation(); startRename(pack); }}>
                  {displayName}
                </span>
              )}

              {/* File count badge */}
              {!isRenaming && pack.installed && pack.total > 0 && (
                <span className={`d-tab-badge ${enabled ? 'ok' : 'muted'}`}>{pack.total}</span>
              )}
              {!isRenaming && (!pack.installed) && (
                <span className="d-tab-badge warn">!</span>
              )}

              {/* Tab action buttons (shown when tab is selected) */}
              {isSelected && !isRenaming && (
                <span className="d-tab-actions" onClick={e => e.stopPropagation()}>
                  <button className="d-tab-btn" title="Rename" onClick={() => startRename(pack)}>✎</button>
                  <button
                    className={`d-tab-btn ${enabled ? '' : 'warn'}`}
                    title={enabled ? 'Disable pack' : 'Enable pack'}
                    onClick={() => toggleEnabled(pack.id)}
                  >{enabled ? '●' : '○'}</button>
                  {isConfirmDel ? (
                    <>
                      <button className="d-tab-btn danger" onClick={() => handleDeletePack(pack.id)}>✓</button>
                      <button className="d-tab-btn" onClick={() => setConfirmDel(null)}>✕</button>
                    </>
                  ) : (
                    <button className="d-tab-btn danger" title="Delete pack" onClick={() => setConfirmDel(pack.id)}>🗑</button>
                  )}
                </span>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Categories */}
      <div className="d-cats-scroll">

        {!selectedMeta && <div className="d-empty-state">No pack selected</div>}

        {selectedMeta && !selectedMeta.installed && (
          <div className="d-notice-card">
            <div className="d-notice-title">{getPackName(selectedMeta.id, selectedMeta.name)} — not installed</div>
            <div className="d-field-label" style={{ marginBottom: 8 }}>ZIP file path</div>
            <div className="d-install-row">
              <input className="d-input" value={zipPaths[selectedMeta.id] ?? ''}
                onChange={e => setZipPaths(p => ({ ...p, [selectedMeta.id]: e.target.value }))}
                placeholder="~/Downloads/pack.zip" />
              <button className="d-btn accent" onClick={() => handleInstall(selectedMeta.id)}
                disabled={installing[selectedMeta.id]}>
                {installing[selectedMeta.id] ? 'Installing…' : 'Install'}
              </button>
            </div>
            {instErr[selectedMeta.id] && <div className="d-error" style={{ marginTop: 6 }}>{instErr[selectedMeta.id]}</div>}
          </div>
        )}

        {selectedMeta && selectedMeta.installed && (
          <>
            {/* Reinstall (known packs only) */}
            {KNOWN_PACKS.has(selectedMeta.id) && (
              <div className="d-reinstall-row">
                <button className="d-link-btn"
                  onClick={() => setShowInst(s => s === selectedMeta.id ? null : selectedMeta.id)}>
                  {showInstall === selectedMeta.id ? '↑ Cancel' : '↺ Reinstall from ZIP'}
                </button>
                {showInstall === selectedMeta.id && (
                  <div className="d-install-row" style={{ marginTop: 8 }}>
                    <input className="d-input" value={zipPaths[selectedMeta.id] ?? ''}
                      onChange={e => setZipPaths(p => ({ ...p, [selectedMeta.id]: e.target.value }))}
                      placeholder="~/Downloads/pack.zip" />
                    <button className="d-btn accent" onClick={() => handleInstall(selectedMeta.id)}
                      disabled={installing[selectedMeta.id]}>
                      {installing[selectedMeta.id] ? 'Installing…' : 'Reinstall'}
                    </button>
                  </div>
                )}
                {instErr[selectedMeta.id] && <div className="d-error" style={{ marginTop: 4 }}>{instErr[selectedMeta.id]}</div>}
              </div>
            )}

            {catLoading
              ? <div className="d-empty-state">Loading…</div>
              : ALL_EVENTS.map(ev => {
                  const files    = catFiles[ev] ?? [];
                  const isOpen   = openCat === ev;
                  const isOver   = dragOver === ev;
                  const isDrop   = dropping[ev];
                  const toggle   = () => setOpenCat(prev => prev === ev ? null : ev);
                  return (
                    <div
                      key={ev}
                      className={`d-cat-card ${isOver ? 'drag-over' : ''} ${isOpen ? 'open' : ''}`}
                      onDragEnter={e => { e.preventDefault(); setDragOver(ev); dragOverRef.current = { packId: selectedMeta.id, event: ev }; }}
                      onDragOver={e => {
                        e.preventDefault();
                        if (dragOver !== ev) { setDragOver(ev); dragOverRef.current = { packId: selectedMeta.id, event: ev }; }
                      }}
                      onDragLeave={e => {
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) {
                          if (dragOver === ev) { setDragOver(null); dragOverRef.current = null; }
                        }
                      }}
                    >
                      {/* ── Collapsed header (always visible, clickable) */}
                      <div className="d-cat-header d-cat-header-btn" onClick={toggle}>
                        <div className="d-cat-header-left">
                          <span className={`d-cat-chevron ${isOpen ? 'open' : ''}`}>›</span>
                          <span className="d-cat-name">{ev}</span>
                        </div>
                        <div className="d-cat-header-right">
                          <span className={`d-cat-pill ${files.length > 0 ? 'ok' : 'empty'}`}>
                            {files.length} {files.length === 1 ? 'file' : 'files'}
                          </span>
                          <button
                            className="d-cat-add-btn"
                            title="Add sound files"
                            onClick={e => {
                              e.stopPropagation();
                              fileInputTarget.current = { packId: selectedMeta.id, event: ev };
                              fileInputRef.current?.click();
                            }}
                          >+</button>
                        </div>
                      </div>

                      {/* ── Expanded body */}
                      {isOpen && (
                        <>
                          {/* File list */}
                          <div className="d-file-list">
                            {files.length === 0
                              ? <div className="d-file-empty">No sounds yet — drop a file below</div>
                              : files.map(fp => (
                                <div key={fp} className="d-file-row">
                                  <button className="d-play-btn" title="Preview" onClick={() => handlePlay(fp)}>
                                    <svg width="9" height="10" viewBox="0 0 9 10" fill="currentColor">
                                      <path d="M1.5 1L8 5L1.5 9V1Z"/>
                                    </svg>
                                  </button>
                                  <span className="d-file-name" title={fileName(fp)}>{fileName(fp)}</span>
                                  <button className="d-del-btn" title="Remove"
                                    onClick={() => handleDeleteFile(selectedMeta.id, ev, fp)}
                                    disabled={deleting === fp}>
                                    {deleting === fp ? '…' : '×'}
                                  </button>
                                </div>
                              ))
                            }
                          </div>

                          {/* Drop hint (replaces old separate drop zone) */}
                          <div className={`d-drop-hint ${isOver ? 'active' : ''} ${isDrop ? 'busy' : ''}`}>
                            {isDrop ? 'Adding…' : isOver ? '↓ Release to add' : '↓ Drop audio files anywhere in this card, or click + to browse'}
                          </div>

                          {/* Path input fallback */}
                          <div className="d-browse-row">
                            <input
                              className="d-input d-path-input"
                              value={browsePath[ev] ?? ''}
                              onChange={e => setBrowsePath(p => ({ ...p, [ev]: e.target.value }))}
                              placeholder="or paste a file path and press Enter…"
                              onKeyDown={e => {
                                if (e.key === 'Enter') handleBrowseAdd(selectedMeta.id, ev);
                                if (e.key === 'Escape') setBrowsePath(p => ({ ...p, [ev]: '' }));
                              }}
                            />
                            {browseErr[ev] && <div className="d-path-err">{browseErr[ev]}</div>}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })
            }
          </>
        )}
      </div>
    </div>
  );
}

// ─── Labels Section ───────────────────────────────────────────────────────────

function LabelsSection() {
  const [lang, setLang] = useState<Lang>('en');
  const [overrides, setOverrides] = useState<LabelOverrides>({ en: {}, ar: {} });
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    invoke<string>('get_label_overrides')
      .then(json => setOverrides(JSON.parse(json)))
      .catch(() => setOverrides({ en: {}, ar: {} }));
  }, []);

  const setKey = (key: string, value: string) => {
    const defaults = translations[lang] as Record<string, unknown>;
    setOverrides(prev => {
      const current = { ...prev[lang] };
      if (value === '' || value === defaults[key]) {
        delete current[key];
      } else {
        current[key] = value;
      }
      return { ...prev, [lang]: current };
    });
  };

  const resetKey = (key: string) => {
    setOverrides(prev => {
      const current = { ...prev[lang] };
      delete current[key];
      return { ...prev, [lang]: current };
    });
  };

  const saveAll = async () => {
    setSaving(true);
    try {
      await invoke('save_label_overrides', { json: JSON.stringify(overrides) });
      setSavedMsg('Saved ✓');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (e: any) {
      setSavedMsg('Error: ' + e);
    }
    setSaving(false);
  };

  const resetLang = () => {
    setOverrides(prev => ({ ...prev, [lang]: {} }));
  };

  const overrideCount = Object.keys(overrides[lang]).length;

  return (
    <div className="d-section">
      <div className="d-section-header">
        <h2>Labels & Text</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && <span style={{ color: 'var(--d-green)', fontSize: 12 }}>{savedMsg}</span>}
          {overrideCount > 0 && (
            <button className="d-btn-sm" onClick={resetLang}>Reset {lang}</button>
          )}
          <button className="d-btn accent" onClick={saveAll} disabled={saving}>
            {saving ? 'Saving…' : 'Save & apply'}
          </button>
        </div>
      </div>

      <div className="d-lang-tabs">
        {(['en', 'ar'] as Lang[]).map(l => (
          <button
            key={l}
            className={`d-lang-tab ${lang === l ? 'active' : ''}`}
            onClick={() => setLang(l)}
          >
            {l === 'en' ? 'English' : 'العربية'}
            {(Object.keys(overrides[l]).length > 0) && (
              <span className="d-override-badge">{Object.keys(overrides[l]).length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="d-labels-scroll">
        {KEY_GROUPS.map(group => (
          <div key={group.title} className="d-label-group">
            <div className="d-label-group-title">{group.title}</div>
            {group.keys.filter(k => STRING_KEYS.includes(k)).map(key => {
              const defaultVal = (translations[lang] as Record<string, unknown>)[key] as string ?? '';
              const currentVal = overrides[lang]?.[key] ?? defaultVal;
              const isOverridden = key in (overrides[lang] ?? {});
              return (
                <div key={key} className="d-label-row">
                  <div className="d-label-key-row">
                    <code className="d-label-key">{key}</code>
                    {isOverridden && (
                      <button className="d-reset-key" onClick={() => resetKey(key)}>↩ reset</button>
                    )}
                  </div>
                  <input
                    className={`d-input d-label-input ${isOverridden ? 'modified' : ''}`}
                    value={currentVal}
                    dir={lang === 'ar' ? 'rtl' : 'ltr'}
                    onChange={e => setKey(key, e.target.value)}
                    placeholder={defaultVal}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Branding Section ─────────────────────────────────────────────────────────

function BrandingSection() {
  const [appName, setAppName] = useState('TASK FM');
  const [logoPath, setLogoPath] = useState('');
  const [trayIconPath, setTrayIconPath] = useState('');
  const [logoPreview, setLogoPreview] = useState('');
  const [trayPreview, setTrayPreview] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');

  useEffect(() => {
    invoke<string>('get_branding').then(json => {
      const b = JSON.parse(json);
      setAppName(b.appName || 'TASK FM');
      setLogoPath(b.logoPath || '');
      setTrayIconPath(b.trayIconPath || '');
      if (b.logoPath) loadPreview(b.logoPath, setLogoPreview);
      if (b.trayIconPath) loadPreview(b.trayIconPath, setTrayPreview);
    }).catch(() => {});
  }, []);

  const loadPreview = async (path: string, setter: (url: string) => void) => {
    if (!path.trim()) { setter(''); return; }
    try {
      const url = await invoke<string>('read_image_as_data_url', { path: path.trim() });
      setter(url);
    } catch { setter(''); }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await invoke('save_branding', { json: JSON.stringify({ appName, logoPath, trayIconPath }) });
      setSavedMsg('Saved ✓');
      setTimeout(() => setSavedMsg(''), 2000);
    } catch (e: any) {
      setSavedMsg('Error: ' + e);
    }
    setSaving(false);
  };

  return (
    <div className="d-section">
      <div className="d-section-header">
        <h2>Branding</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ color: savedMsg.startsWith('Error') ? 'var(--d-danger)' : 'var(--d-green)', fontSize: 12 }}>
              {savedMsg}
            </span>
          )}
          <button className="d-btn accent" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save & apply'}
          </button>
        </div>
      </div>

      <div className="d-pack-list">
        {/* App Name */}
        <div className="d-card">
          <div className="d-card-title">App Name</div>
          <div className="d-field-label">Shown in the app footer and menu bar tooltip</div>
          <input
            className="d-input"
            value={appName}
            onChange={e => setAppName(e.target.value)}
            placeholder="TASK FM"
          />
        </div>

        {/* Logo */}
        <div className="d-card">
          <div className="d-card-title">Logo Image</div>
          <div className="d-field-label">PNG / JPG — displayed in the app footer</div>
          <input
            className="d-input"
            value={logoPath}
            onChange={e => { setLogoPath(e.target.value); loadPreview(e.target.value, setLogoPreview); }}
            placeholder="/path/to/logo.png"
          />
          {logoPreview && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--d-bg3)', borderRadius: 6, display: 'flex', justifyContent: 'center' }}>
              <img src={logoPreview} style={{ maxHeight: 64, maxWidth: '100%', objectFit: 'contain' }} />
            </div>
          )}
        </div>

        {/* Menu Bar Icon */}
        <div className="d-card">
          <div className="d-card-title">Menu Bar Icon</div>
          <div className="d-field-label">PNG — replaces the tray icon (recommended: 22×22px, transparent background)</div>
          <input
            className="d-input"
            value={trayIconPath}
            onChange={e => { setTrayIconPath(e.target.value); loadPreview(e.target.value, setTrayPreview); }}
            placeholder="/path/to/icon.png"
          />
          {trayPreview && (
            <div style={{ marginTop: 10, padding: 12, background: 'var(--d-bg3)', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
              <img src={trayPreview} style={{ height: 22, width: 22, objectFit: 'contain' }} />
              <span style={{ fontSize: 11, color: 'var(--d-text2)' }}>Preview at tray size (22 × 22 px)</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [tab, setTab] = useState<'sounds' | 'labels' | 'branding'>('sounds');

  return (
    <div className="d-app">
      <aside className="d-sidebar">
        <div className="d-sidebar-brand">
          <span className="d-brand-dot" />
          TASK FM
        </div>
        <nav className="d-nav">
          <button
            className={`d-nav-item ${tab === 'sounds' ? 'active' : ''}`}
            onClick={() => setTab('sounds')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M9 18V5l12-2v13" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="6" cy="18" r="3" stroke="currentColor" strokeWidth="1.8"/>
              <circle cx="18" cy="16" r="3" stroke="currentColor" strokeWidth="1.8"/>
            </svg>
            Sounds
          </button>
          <button
            className={`d-nav-item ${tab === 'labels' ? 'active' : ''}`}
            onClick={() => setTab('labels')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <path d="M4 6h16M4 12h10M4 18h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Labels
          </button>
          <button
            className={`d-nav-item ${tab === 'branding' ? 'active' : ''}`}
            onClick={() => setTab('branding')}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            Branding
          </button>
        </nav>
        <div className="d-sidebar-footer">Admin Dashboard</div>
      </aside>

      <main className="d-main">
        {tab === 'sounds'   && <SoundsSection />}
        {tab === 'labels'   && <LabelsSection />}
        {tab === 'branding' && <BrandingSection />}
      </main>
    </div>
  );
}
