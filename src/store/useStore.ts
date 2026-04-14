import { create } from 'zustand';
import { Task, Settings, AppView, ChecklistStep } from '../types';
import { save, load } from '../storage';
import { playSound } from '../sounds/soundEngine';

const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'en',
  soundEnabled: true,
  soundVolume: 0.6,
  activeSoundPack: 'default',
  soundEvents: {
    taskCreated: true,
    stepCompleted: true,
    taskCompleted: true,
  },
  idleSound: {
    enabled: false,
    frequencyHours: 3,
    randomize: true,
    dayStart: 9,
    dayEnd: 21,
  },
  launchAtStartup: false,
  autoSortCompleted: true,
  animationsEnabled: true,
  customSoundsEnabled: true,
  labelOverrides: { en: {}, ar: {} },
};

interface Store {
  tasks: Task[];
  settings: Settings;
  view: AppView;
  onboardingDone: boolean;
  hydrated: boolean;
  branding: { appName: string; logoDataUrl: string };
  userPacks: { id: string; name: string }[];

  hydrate: () => Promise<void>;
  setView: (view: AppView) => void;
  setBranding: (b: { appName: string; logoDataUrl: string }) => void;

  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'completed' | 'archived' | 'trashed'>) => string;
  reorderTaskItems: (fromId: string, toId: string) => void;
  deleteTask: (id: string) => void;
  restoreFromTrash: (id: string) => void;
  permanentDeleteTask: (id: string) => void;
  emptyTrash: () => void;
  archiveTask: (id: string) => void;
  unarchiveTask: (id: string) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  toggleTaskComplete: (id: string) => void;
  autoArchiveStale: () => void;

  toggleStep: (taskId: string, stepId: string) => void;
  addStep: (taskId: string, step: Omit<ChecklistStep, 'id'>) => void;
  deleteStep: (taskId: string, stepId: string) => void;
  updateStep: (taskId: string, stepId: string, updates: Partial<ChecklistStep>) => void;
  reorderSteps: (taskId: string, fromIndex: number, toIndex: number) => void;

  updateSettings: (updates: Partial<Settings>) => void;
  completeOnboarding: (settings: Partial<Settings>) => void;
  setUserPacks: (packs: { id: string; name: string }[]) => void;
  clearAllTasks: () => void;
  logout: () => void;
}

export const useStore = create<Store>((set, get) => ({
  tasks: [],
  settings: DEFAULT_SETTINGS,
  view: 'tasks',
  onboardingDone: false,
  hydrated: false,
  branding: { appName: 'TASK FM', logoDataUrl: '' },
  userPacks: [],

  hydrate: async () => {
    try {
      const stored = await load();
      const storedS = (stored.settings as any) ?? {};
      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...storedS,
        idleSound: {
          ...DEFAULT_SETTINGS.idleSound,
          ...(storedS.idleSound ?? {}),
        },
        soundEvents: {
          ...DEFAULT_SETTINGS.soundEvents,
          ...(storedS.soundEvents ?? {}),
        },
        labelOverrides: {
          en: { ...(storedS.labelOverrides?.en ?? {}) },
          ar: { ...(storedS.labelOverrides?.ar ?? {}) },
        },
      };
      set({
        tasks: (stored.tasks ?? []).map(t => ({ ...t, steps: t.steps ?? [] })),
        settings: mergedSettings,
        onboardingDone: stored.onboardingDone ?? false,
        hydrated: true,
        view: stored.onboardingDone ? 'tasks' : 'onboarding',
      });
    } catch {
      set({ hydrated: true });
    }
  },

  setView: (view) => set({ view }),
  setBranding: (b) => set({ branding: b }),
  setUserPacks: (packs) => set({ userPacks: packs }),

  addTask: (taskData) => {
    const id = crypto.randomUUID();
    const task: Task = {
      ...taskData,
      id,
      createdAt: new Date().toISOString(),
      completed: false,
      archived: false,
      trashed: false,
    };
    const tasks = [task, ...get().tasks];
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });

    const { settings } = get();
    if (settings.soundEnabled && settings.soundEvents.taskCreated) {
      playSound('taskCreated', settings.activeSoundPack, settings.soundVolume);
    }
    return id;
  },

  reorderTaskItems: (fromId, toId) => {
    const tasks = [...get().tasks];
    const fromIdx = tasks.findIndex(t => t.id === fromId);
    const toIdx   = tasks.findIndex(t => t.id === toId);
    if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return;
    const [moved] = tasks.splice(fromIdx, 1);
    tasks.splice(toIdx, 0, moved);
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  toggleTaskComplete: (id) => {
    const { tasks, settings } = get();
    const task = tasks.find((t) => t.id === id);
    if (!task) return;

    const nowCompleting = !task.completed;
    const updatedSteps = task.steps.map((s) => ({ ...s, checked: nowCompleting }));
    const updatedTask: Task = {
      ...task,
      steps: updatedSteps,
      completed: nowCompleting,
      completedAt: nowCompleting ? new Date().toISOString() : undefined, // Mod 32
    };
    const updatedTasks = tasks.map((t) => (t.id === id ? updatedTask : t));

    set({ tasks: updatedTasks });
    save({ tasks: updatedTasks, settings, onboardingDone: get().onboardingDone });

    if (nowCompleting && settings.soundEnabled && settings.soundEvents.taskCompleted) {
      playSound('taskCompleted', settings.activeSoundPack, settings.soundVolume);
    }
  },

  archiveTask: (id) => {
    const tasks = get().tasks.map((t) => t.id === id ? { ...t, archived: true } : t);
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  unarchiveTask: (id) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, archived: false, completed: false, completedAt: undefined } : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  // Mod 32: auto-archive completed tasks older than 2.5 days
  autoArchiveStale: () => {
    const THRESHOLD_MS = 2.5 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const tasks = get().tasks.map((t) => {
      if (!t.archived && t.completed && t.completedAt) {
        const age = now - new Date(t.completedAt).getTime();
        if (age > THRESHOLD_MS) return { ...t, archived: true };
      }
      return t;
    });
    const changed = tasks.some((t, i) => t.archived !== get().tasks[i].archived);
    if (changed) {
      set({ tasks });
      save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
    }
  },

  deleteTask: (id) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, trashed: true, trashedAt: new Date().toISOString() } : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });

    const { settings } = get();
    if (settings.soundEnabled) {
      playSound('taskDeleted', settings.activeSoundPack, settings.soundVolume);
    }
  },

  restoreFromTrash: (id) => {
    const tasks = get().tasks.map((t) =>
      t.id === id ? { ...t, trashed: false, trashedAt: undefined } : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  permanentDeleteTask: (id) => {
    const tasks = get().tasks.filter((t) => t.id !== id);
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  emptyTrash: () => {
    const tasks = get().tasks.filter((t) => !t.trashed);
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  updateTask: (id, updates) => {
    const tasks = get().tasks.map((t) => (t.id === id ? { ...t, ...updates } : t));
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  toggleStep: (taskId, stepId) => {
    const { tasks, settings } = get();
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    // Mod 55: track whether step is being checked (true) or unchecked (false)
    const step = task.steps.find((s) => s.id === stepId);
    const isChecking = !!(step && !step.checked);

    const updatedSteps = task.steps.map((s) =>
      s.id === stepId ? { ...s, checked: !s.checked } : s
    );

    const sorted = settings.autoSortCompleted
      ? [...updatedSteps].sort((a, b) => {
          if (a.checked === b.checked) return 0;
          return a.checked ? 1 : -1;
        })
      : updatedSteps;

    const allCompleted = sorted.length > 0 && sorted.every((s) => s.checked);
    const wasCompleted = task.completed;

    const updatedTask: Task = { ...task, steps: sorted, completed: allCompleted };
    const updatedTasks = tasks.map((t) => (t.id === taskId ? updatedTask : t));

    set({ tasks: updatedTasks });
    save({ tasks: updatedTasks, settings, onboardingDone: get().onboardingDone });

    if (settings.soundEnabled) {
      if (allCompleted && !wasCompleted && settings.soundEvents.taskCompleted) {
        playSound('taskCompleted', settings.activeSoundPack, settings.soundVolume);
      } else if (isChecking && !allCompleted && settings.soundEvents.stepCompleted) {
        // Mod 55: only play on check, not uncheck
        playSound('stepCompleted', settings.activeSoundPack, settings.soundVolume);
      }
    }
  },

  addStep: (taskId, stepData) => {
    const step: ChecklistStep = { ...stepData, id: crypto.randomUUID() };
    let wasCompleted = false;
    const mapped = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      wasCompleted = t.completed;
      return {
        ...t,
        steps: [...t.steps, step],
        // New unchecked step on a completed task → reopen it
        ...(t.completed ? { completed: false, completedAt: undefined } : {}),
      };
    });

    // Move the reopened task to the top of the list so it appears immediately
    // in the active section rather than staying at its old sorted position.
    let tasks = mapped;
    if (wasCompleted) {
      const idx = mapped.findIndex(t => t.id === taskId);
      if (idx > 0) {
        tasks = [mapped[idx], ...mapped.slice(0, idx), ...mapped.slice(idx + 1)];
      }
    }

    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });

    // Play special sound when task now has exactly 4 steps (crossed the "many" threshold)
    const updatedTask = tasks.find(t => t.id === taskId);
    const { settings } = get();
    if (updatedTask && updatedTask.steps.length === 4 && settings.soundEnabled) {
      playSound('taskHasManyChecklistItems', settings.activeSoundPack, settings.soundVolume);
    }
  },

  deleteStep: (taskId, stepId) => {
    const tasks = get().tasks.map((t) =>
      t.id === taskId ? { ...t, steps: t.steps.filter((s) => s.id !== stepId) } : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });

    const { settings } = get();
    if (settings.soundEnabled) {
      playSound('stepDeleted', settings.activeSoundPack, settings.soundVolume);
    }
  },

  updateStep: (taskId, stepId, updates) => {
    const tasks = get().tasks.map((t) =>
      t.id === taskId
        ? { ...t, steps: t.steps.map((s) => s.id === stepId ? { ...s, ...updates } : s) }
        : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  reorderSteps: (taskId, fromIndex, toIndex) => {
    if (fromIndex === toIndex) return;
    const tasks = get().tasks.map((t) => {
      if (t.id !== taskId) return t;
      const steps = [...t.steps];
      const [moved] = steps.splice(fromIndex, 1);
      steps.splice(toIndex, 0, moved);
      return { ...t, steps };
    });
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });
  },

  updateSettings: (updates) => {
    const settings = { ...get().settings, ...updates };
    set({ settings });
    save({ tasks: get().tasks, settings, onboardingDone: get().onboardingDone });
  },

  completeOnboarding: (settingsOverride) => {
    const settings = { ...get().settings, ...settingsOverride };
    set({ settings, onboardingDone: true, view: 'tasks' });
    save({ tasks: get().tasks, settings, onboardingDone: true });
  },

  clearAllTasks: () => {
    const tasks = get().tasks.map((t) =>
      !t.archived && !t.trashed
        ? { ...t, trashed: true, trashedAt: new Date().toISOString() }
        : t
    );
    set({ tasks });
    save({ tasks, settings: get().settings, onboardingDone: get().onboardingDone });

    const { settings } = get();
    if (settings.soundEnabled) {
      playSound('taskDeleted', settings.activeSoundPack, settings.soundVolume);
    }
  },

  logout: () => {
    const settings = { ...get().settings, userName: undefined, userEmail: undefined };
    set({ settings, onboardingDone: false, view: 'onboarding' });
    save({ tasks: get().tasks, settings, onboardingDone: false });
  },
}));
