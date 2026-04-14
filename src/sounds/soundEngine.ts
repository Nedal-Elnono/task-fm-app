import { SoundPack, SoundEvent } from '../types';

// ─── Known file-based packs ───────────────────────────────────────────────────

export const SOUND_PACKS: SoundPack[] = [
  { id: 'elsisi',  name: 'Elsisi',   sounds: {} },
  { id: 'bahgt',   name: 'Bahgt',    sounds: {} },
  { id: 'elguyar', name: 'El Guyar', sounds: {} },
];

// All pack IDs that live on disk (not synthesized)
// Mutable — dynamic user packs are added at runtime via refreshAllPacks
let FILE_PACK_IDS = new Set(['elsisi', 'bahgt', 'elguyar']);

// Static built-in IDs — never treated as user-created packs
const STATIC_PACK_IDS = new Set(['elsisi', 'bahgt', 'elguyar', 'custom']);

export const FILE_PACK_ZIP_NAMES: Record<string, string> = {
  elsisi:  'Elsisi sounds.zip',
  bahgt:   'bahgt sounds.zip',
  elguyar: 'ELguyar sounds.zip',
};

// ─── File pack index ──────────────────────────────────────────────────────────

const filePackPaths: Record<string, Record<string, string[]>> = {};
const filePackInstalled: Record<string, boolean> = {};

const ALL_EVENTS: SoundEvent[] = [
  'taskCreated',
  'stepCompleted',
  'taskCompleted',
  'stepDeleted',
  'taskDeleted',
  'randomIdle',
  'inactivityReminder',
  'taskHasManyChecklistItems',
];

export async function initFilePack(packId: string): Promise<boolean> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    filePackPaths[packId] = {};
    for (const event of ALL_EVENTS) {
      const files = await invoke<string[]>('scan_file_pack_files', { packId, event });
      filePackPaths[packId][event] = files.filter(f => !f.includes('/._'));
    }
    const total = getFilePackCount(packId);
    filePackInstalled[packId] = total > 0;
    console.log(`[Sound] initFilePack("${packId}") → ${total} files`);
    if (total > 0) {
      const summary = Object.entries(filePackPaths[packId])
        .filter(([, v]) => v.length > 0)
        .map(([k, v]) => `${k}:${v.length}`)
        .join(', ');
      console.log(`[Sound]   ${summary}`);
    }
    return filePackInstalled[packId];
  } catch (e) {
    console.error(`[Sound] initFilePack("${packId}") failed:`, e);
    return false;
  }
}

export function isFilePackInstalled(packId: string): boolean {
  return filePackInstalled[packId] ?? false;
}

export function getFilePackCount(packId: string): number {
  return Object.values(filePackPaths[packId] ?? {}).reduce((s, a) => s + a.length, 0);
}

// Backwards-compat exports (used by Settings.tsx + App.tsx)
export async function initElsisiSounds(): Promise<boolean> { return initFilePack('elsisi'); }
export function isElsisiInstalled(): boolean { return isFilePackInstalled('elsisi'); }
export function getElsisiSoundCount(): number { return getFilePackCount('elsisi'); }

// ─── Custom sounds (user's personal upload folder) ────────────────────────────

const customFilePaths: Record<string, string[]> = {};
let customSoundsDir = '';

export async function initCustomSounds(): Promise<string> {
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    customSoundsDir = await invoke<string>('get_sounds_dir');
    const basicEvents: SoundEvent[] = ['taskCreated', 'stepCompleted', 'taskCompleted', 'randomIdle'];
    for (const event of basicEvents) {
      const files = await invoke<string[]>('scan_sound_files', { event });
      customFilePaths[event] = files.filter(f => !f.includes('/._'));
    }
    return customSoundsDir;
  } catch {
    return '';
  }
}

export function getCustomSoundsDir() { return customSoundsDir; }
export function getCustomSoundCount() {
  return Object.values(customFilePaths).reduce((sum, arr) => sum + arr.length, 0);
}
export async function rescanCustomSounds(): Promise<void> {
  Object.keys(customFilePaths).forEach(k => delete customFilePaths[k]);
  await initCustomSounds();
}

// ─── Full pack refresh — called on startup + after sounds-updated event ───────

export async function refreshAllPacks(): Promise<{ id: string; name: string }[]> {
  let diskIds: string[] = [];
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    diskIds = await invoke<string[]>('list_sound_packs');
  } catch {}

  const diskSet = new Set(diskIds);
  for (const id of Array.from(FILE_PACK_IDS)) {
    if (!diskSet.has(id) && !['elsisi', 'bahgt', 'elguyar'].includes(id)) {
      FILE_PACK_IDS.delete(id);
    }
  }
  for (const id of diskIds) FILE_PACK_IDS.add(id);

  await Promise.all(Array.from(FILE_PACK_IDS).map(id => initFilePack(id)));
  await initCustomSounds();
  dataUrlCache.clear();

  const userPacks = diskIds
    .filter(id => !STATIC_PACK_IDS.has(id))
    .map(id => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1).replace(/[-_]/g, ' ') }));

  console.log('[Sound] refreshAllPacks — disk:', diskIds);
  console.log('[Sound] user packs:', userPacks);
  return userPacks;
}

// ─── Data-URL cache (file path → data: URL) ───────────────────────────────────

const dataUrlCache = new Map<string, string>();

async function loadDataUrl(path: string): Promise<string | null> {
  if (dataUrlCache.has(path)) return dataUrlCache.get(path)!;
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const url = await invoke<string>('read_sound_as_data_url', { path });
    dataUrlCache.set(path, url);
    return url;
  } catch (e) {
    console.error(`[Sound] loadDataUrl failed for "${path}":`, e);
    return null;
  }
}

// ─── Audio event bus ──────────────────────────────────────────────────────────

type AudioPlayCallback = (event: SoundEvent) => void;
type AudioStopCallback = () => void;

const _audioListeners: AudioPlayCallback[] = [];
const _stopListeners: AudioStopCallback[] = [];

export function onAudioPlay(cb: AudioPlayCallback): () => void {
  _audioListeners.push(cb);
  return () => { const i = _audioListeners.indexOf(cb); if (i !== -1) _audioListeners.splice(i, 1); };
}
export function onAudioStop(cb: AudioStopCallback): () => void {
  _stopListeners.push(cb);
  return () => { const i = _stopListeners.indexOf(cb); if (i !== -1) _stopListeners.splice(i, 1); };
}
function _notifyAudioPlay(event: SoundEvent) { _audioListeners.forEach(cb => cb(event)); }
function _notifyAudioStop() { _stopListeners.forEach(cb => cb()); }

// ─── Single active audio ──────────────────────────────────────────────────────

let _currentAudio: HTMLAudioElement | null = null;

function stopCurrentSound() {
  if (_currentAudio) {
    _currentAudio.pause();
    _currentAudio.currentTime = 0;
    _currentAudio = null;
  }
}

// ─── AudioContext + Analyser (for tray wave — no synth) ───────────────────────

const ctx: AudioContext | null =
  typeof AudioContext !== 'undefined' ? new AudioContext() : null;

const analyser: AnalyserNode | null = ctx ? (() => {
  const a = ctx.createAnalyser();
  a.fftSize = 64;
  a.smoothingTimeConstant = 0.70;
  a.connect(ctx.destination);
  return a;
})() : null;

export function getAnalyser(): AnalyserNode | null { return analyser; }

// ─── File playback ────────────────────────────────────────────────────────────

async function playFile(url: string, volume: number) {
  try {
    const audio = new Audio(url);
    audio.volume = volume;
    _currentAudio = audio;

    if (ctx && analyser) {
      try {
        const src = ctx.createMediaElementSource(audio);
        src.connect(analyser);
      } catch { /* element may already have a source node */ }
    }

    const cleanup = () => {
      if (_currentAudio === audio) { _currentAudio = null; _notifyAudioStop(); }
    };
    audio.addEventListener('ended',   cleanup);
    audio.addEventListener('error',   cleanup);
    audio.addEventListener('abort',   cleanup);
    audio.addEventListener('stalled', cleanup);

    audio.addEventListener('play', () => {
      try {
        if ('mediaSession' in navigator) {
          (navigator as any).mediaSession.metadata = null;
          (navigator as any).mediaSession.playbackState = 'none';
        }
      } catch { /* ignore */ }
    });

    await audio.play();
  } catch {
    _currentAudio = null;
    _notifyAudioStop();
  }
}

// ─── No-repeat history ────────────────────────────────────────────────────────

const playHistory: string[] = [];
const HISTORY_SIZE = 3;

function pickFresh(candidates: string[]): string {
  if (candidates.length === 1) { playHistory.push(candidates[0]); return candidates[0]; }
  const fresh = candidates.filter(c => !playHistory.includes(c));
  const pool = fresh.length > 0 ? fresh : candidates;
  const last = playHistory[playHistory.length - 1];
  const filtered = pool.length > 1 ? pool.filter(c => c !== last) : pool;
  const pick = filtered[Math.floor(Math.random() * filtered.length)];
  playHistory.push(pick);
  if (playHistory.length > HISTORY_SIZE) playHistory.shift();
  return pick;
}

// ─── Main play function ───────────────────────────────────────────────────────

export function playSound(event: SoundEvent, packId: string, volume: number) {
  stopCurrentSound();
  console.log(`[Sound] play event="${event}" pack="${packId}" vol=${volume}`);

  // 1. Custom upload folder always wins
  const customPaths = customFilePaths[event];
  if (customPaths && customPaths.length > 0) {
    const path = pickFresh(customPaths);
    console.log(`[Sound] → custom: ${path}`);
    _notifyAudioPlay(event);
    loadDataUrl(path).then(url => {
      if (url) playFile(url, volume);
      else _notifyAudioStop();
    });
    return;
  }

  // 2. Selected pack
  if (FILE_PACK_IDS.has(packId)) {
    const paths = filePackPaths[packId]?.[event];
    console.log(`[Sound] → pack "${packId}" / "${event}": ${paths?.length ?? 0} files`);
    if (paths && paths.length > 0) {
      const path = pickFresh(paths);
      console.log(`[Sound] → playing: ${path}`);
      _notifyAudioPlay(event);
      loadDataUrl(path).then(url => {
        if (url) playFile(url, volume);
        else _notifyAudioStop();
      });
      return;
    }
    // Pack has no files for this event — play nothing
    console.warn(`[Sound] → no files for "${event}" in pack "${packId}" — silent`);
    return;
  }

  // Pack not recognised — play nothing
  console.warn(`[Sound] → pack "${packId}" not in FILE_PACK_IDS — silent`);
}
