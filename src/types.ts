export interface ChecklistStep {
  id: string;
  title: string;
  checked: boolean;
}

export interface Task {
  id: string;
  title: string;
  note?: string;
  deadline?: string;
  steps: ChecklistStep[];
  completed: boolean;
  archived: boolean;
  trashed: boolean;
  createdAt: string;
  completedAt?: string;
  trashedAt?: string;
}

export type SoundEvent =
  | 'taskCreated'
  | 'stepCompleted'
  | 'taskCompleted'
  | 'stepDeleted'
  | 'taskDeleted'
  | 'randomIdle'
  | 'inactivityReminder'
  | 'taskHasManyChecklistItems';

export interface SoundPack {
  id: string;
  name: string;
  sounds: Partial<Record<SoundEvent, string[]>>;
}

export interface IdleSoundSettings {
  enabled: boolean;
  frequencyHours: number;  // play every N hours
  randomize: boolean;      // randomize within the window
  dayStart: number;        // hour 0–23
  dayEnd: number;          // hour 0–23
}

export interface LabelOverrides {
  en: Record<string, string>;
  ar: Record<string, string>;
}

export interface Settings {
  theme: 'dark' | 'light' | 'system';
  language: string;
  soundEnabled: boolean;
  soundVolume: number;
  activeSoundPack: string;
  soundEvents: {
    taskCreated: boolean;
    stepCompleted: boolean;
    taskCompleted: boolean;
  };
  idleSound: IdleSoundSettings;
  launchAtStartup: boolean;
  autoSortCompleted: boolean;
  animationsEnabled: boolean;
  customSoundsEnabled: boolean;
  labelOverrides: LabelOverrides;
  userName?: string;
  userEmail?: string;
}

export type AppView = 'tasks' | 'settings' | 'onboarding' | 'archive' | 'trash';
