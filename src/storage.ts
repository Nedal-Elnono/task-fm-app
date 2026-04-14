import { Task, Settings } from './types';

interface StoredData {
  tasks: Task[];
  settings: Settings;
  onboardingDone: boolean;
}

const STORAGE_KEY = 'taskfm_data';

// Use localStorage as fallback when Store plugin isn't ready
export async function save(data: Partial<StoredData>): Promise<void> {
  try {
    const existing = await load();
    const merged = { ...existing, ...data };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    // silent
  }
}

export async function load(): Promise<Partial<StoredData>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // silent
  }
  return {};
}
