import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';
import { Task, ChecklistStep } from '../types';
import { onAudioPlay, onAudioStop } from '../sounds/soundEngine';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getProgress(task: Task) {
  if (task.steps.length === 0) return null;
  const done = task.steps.filter((s) => s.checked).length;
  return { done, total: task.steps.length, pct: Math.round((done / task.steps.length) * 100) };
}

function isOverdue(deadline?: string) {
  if (!deadline) return false;
  return new Date(deadline) < new Date();
}

function fmtDeadline(deadline: string) {
  const d = new Date(deadline);
  const diff = Math.ceil((d.getTime() - Date.now()) / 86400000);
  if (diff < 0) return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Audio-Reactive Waveform ──────────────────────────────────────────────────

function Waveform() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    // Mod 29: activate on play, deactivate exactly when sound stops
    const unsubPlay = onAudioPlay(() => setActive(true));
    const unsubStop = onAudioStop(() => setActive(false));
    return () => { unsubPlay(); unsubStop(); };
  }, []);

  return (
    <div className={`waveform ${active ? 'active' : ''}`}>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="waveform-bar" style={{ animationDelay: `${i * 90}ms` }} />
      ))}
    </div>
  );
}

// ─── Context Menu ─────────────────────────────────────────────────────────────

interface ContextMenuProps {
  x: number;
  y: number;
  onArchive: () => void;
  onDelete: () => void;
  onClose: () => void;
}

function ContextMenu({ x, y, onArchive, onDelete, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const t = useT();

  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const maxX = window.innerWidth - width - 8;
    const maxY = window.innerHeight - height - 8;
    setPos({ x: Math.min(x, maxX), y: Math.min(y, maxY) });
  }, [x, y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      className="ctx-menu"
      style={{ left: pos.x, top: pos.y }}
      initial={{ opacity: 0, scale: 0.94, y: -4 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.94, y: -4 }}
      transition={{ duration: 0.1 }}
    >
      <button className="ctx-item" onClick={() => { onArchive(); onClose(); }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="3" rx="1" stroke="currentColor" strokeWidth="1.3"/>
          <path d="M2.5 6v6.5a1 1 0 001 1h9a1 1 0 001-1V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          <path d="M6 9.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t.archiveTask}
      </button>
      <div className="ctx-divider" />
      <button className="ctx-item danger" onClick={() => { onDelete(); onClose(); }}>
        <svg width="13" height="13" viewBox="0 0 14 16" fill="none">
          <path d="M1 3.5h12M5 3.5V2.5a.5.5 0 01.5-.5h3a.5.5 0 01.5.5v1M2.5 3.5l.8 10a.5.5 0 00.5.5h6.4a.5.5 0 00.5-.5l.8-10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        {t.deleteTask}
      </button>
    </motion.div>
  );
}

// ─── Inline New Task Row ──────────────────────────────────────────────────────

function NewTaskRow({ onSave, onCancel }: { onSave: (title: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  const committedRef = useRef(false);
  const t = useT();
  useEffect(() => { ref.current?.focus(); }, []);

  const commit = () => {
    if (committedRef.current) return;
    committedRef.current = true;
    const v = value.trim();
    if (v) onSave(v);
    else onCancel();
  };

  return (
    <motion.div
      className="new-task-row"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="new-task-dot" />
      <input
        ref={ref}
        className="new-task-input"
        placeholder={t.taskNamePlaceholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') onCancel();
        }}
        onBlur={commit}
      />
    </motion.div>
  );
}

// ─── Checklist Item Row ───────────────────────────────────────────────────────

interface ChecklistRowProps {
  step: ChecklistStep;
  index: number;
  onToggle: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onDragStart: (e: React.MouseEvent) => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

function ChecklistRow({ step, onToggle, onDelete, onRename, onDragStart, isDragging, isDropTarget }: ChecklistRowProps) {
  const [hovered, setHovered]                     = useState(false);
  const [editing, setEditing]                     = useState(false);
  const [draft,   setDraft]                       = useState(step.title);
  const [confirmStepDelete, setConfirmStepDelete] = useState(false);
  const inputRef                                  = useRef<HTMLInputElement>(null);

  const startEdit = (e: React.MouseEvent) => {
    if (step.checked) return;
    e.stopPropagation();
    setDraft(step.title);
    setEditing(true);
    setTimeout(() => { inputRef.current?.focus(); inputRef.current?.select(); }, 0);
  };

  const commit = () => {
    const t = draft.trim();
    if (t && t !== step.title) onRename(t);
    else setDraft(step.title);
    setEditing(false);
  };

  return (
    <motion.div
      className={`inline-step-row ${isDragging ? 'step-dragging' : ''} ${isDropTarget ? 'step-drop-target' : ''}`}
      layout
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: isDragging ? 0.4 : 1, x: 0 }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.14 }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Drag handle */}
      <div
        className={`step-drag-handle ${hovered && !editing ? 'visible' : ''}`}
        onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onDragStart(e); }}
      >
        <svg width="8" height="12" viewBox="0 0 8 12" fill="currentColor">
          <circle cx="2" cy="2" r="1.2"/><circle cx="6" cy="2" r="1.2"/>
          <circle cx="2" cy="6" r="1.2"/><circle cx="6" cy="6" r="1.2"/>
          <circle cx="2" cy="10" r="1.2"/><circle cx="6" cy="10" r="1.2"/>
        </svg>
      </div>

      {/* Checkbox */}
      <motion.div
        className={`step-check ${step.checked ? 'checked' : ''}`}
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        animate={step.checked ? { scale: [1, 1.18, 1] } : { scale: 1 }}
        transition={{ duration: 0.16 }}
      >
        {step.checked && (
          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
            <path d="M1 3.5L3.2 6L8 1" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </motion.div>

      {editing ? (
        <input
          ref={inputRef}
          className="step-rename-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter')  { e.preventDefault(); commit(); }
            if (e.key === 'Escape') { setDraft(step.title); setEditing(false); }
            e.stopPropagation();
          }}
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span
          className={`inline-step-title ${step.checked ? 'checked' : ''}`}
          style={{ flex: 1 }}
          onClick={startEdit}
          title={step.checked ? undefined : 'Click to rename'}
        >
          {step.title}
        </span>
      )}

      {/* Delete button / confirmation (visible on hover) */}
      {!editing && (
        confirmStepDelete ? (
          <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
            <button className="delete-confirm-yes" onClick={() => onDelete()}>✓</button>
            <button className="delete-confirm-no"  onClick={() => setConfirmStepDelete(false)}>✕</button>
          </div>
        ) : (
          <button
            className={`step-delete-btn ${hovered ? 'visible' : ''}`}
            onClick={(e) => { e.stopPropagation(); setConfirmStepDelete(true); }}
            title="Remove item"
          >
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        )
      )}
    </motion.div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  isExpanded: boolean;       // Mod 41: controlled from TaskList
  onExpand: () => void;      // Mod 41: collapses others automatically
  autoAddItem?: boolean;     // Mod 39: open checklist input immediately
  onTaskDragStart: () => void; // Mod 40
  isDraggingTask?: boolean;
  isDropTargetTask?: boolean;
}

function TaskCard({ task, isExpanded, onExpand, autoAddItem, onTaskDragStart, isDraggingTask, isDropTargetTask }: TaskCardProps) {
  const t                  = useT();
  const toggleStep         = useStore((s) => s.toggleStep);
  const addStep            = useStore((s) => s.addStep);
  const deleteStep         = useStore((s) => s.deleteStep);
  const updateStep         = useStore((s) => s.updateStep);
  const deleteTask         = useStore((s) => s.deleteTask);
  const archiveTask        = useStore((s) => s.archiveTask);
  const toggleTaskComplete = useStore((s) => s.toggleTaskComplete);
  const updateTask         = useStore((s) => s.updateTask);
  const reorderSteps       = useStore((s) => s.reorderSteps);

  const [addingItem, setAddingItem]       = useState(false);
  const [itemValue, setItemValue]         = useState('');
  const [editingTitle, setEditingTitle]   = useState(false);
  const [titleDraft, setTitleDraft]       = useState(task.title);
  const [ctxMenu, setCtxMenu]             = useState<{ x: number; y: number } | null>(null);
  // Mod 25: delayed hover delete reveal
  const [showDeleteBtn, setShowDeleteBtn] = useState(false);
  const hoverTimerRef                     = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mod 26: inline delete confirmation
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ── Drag state
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const dragFromRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const stepsRef = useRef<HTMLDivElement>(null);

  const itemRef  = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  const prog    = getProgress(task);
  const overdue = isOverdue(task.deadline) && !task.completed;

  // Mod 39: auto-open step input when task just created
  useEffect(() => {
    if (autoAddItem) setAddingItem(true);
  }, [autoAddItem]);

  useEffect(() => {
    if (addingItem) itemRef.current?.focus();
  }, [addingItem]);

  // ── checklist item commit (used by blur)
  const commitItem = () => {
    const v = itemValue.trim();
    if (v) addStep(task.id, { title: v, checked: false });
    setItemValue('');
    setAddingItem(false);
  };

  // Mod 39: task auto-expands after creation so "+ checklist" is visible immediately

  // ── title edit commit
  const commitTitle = () => {
    const t = titleDraft.trim();
    if (t && t !== task.title) updateTask(task.id, { title: t });
    else setTitleDraft(task.title);
    setEditingTitle(false);
  };

  useEffect(() => {
    if (editingTitle) {
      titleRef.current?.focus();
      titleRef.current?.select();
    }
  }, [editingTitle]);

  // ── right-click
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCtxMenu({ x: e.clientX, y: e.clientY });
  }, []);

  // ── Mod 40: drag-on-hover — after showDeleteBtn activates, card becomes draggable
  const wasDraggingRef = useRef(false);
  const handleCardMouseDown = useCallback((e: React.MouseEvent) => {
    if (!showDeleteBtn) return;
    if ((e.target as HTMLElement).closest('button, input')) return;
    e.preventDefault();
    wasDraggingRef.current = false;
    const startY = e.clientY;
    const onMove = (ev: MouseEvent) => {
      if (!wasDraggingRef.current && Math.abs(ev.clientY - startY) > 5) {
        wasDraggingRef.current = true;
        onTaskDragStart();
      }
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [showDeleteBtn, onTaskDragStart]);

  // ── Mod 25: delayed hover delete reveal
  const handleHeaderMouseEnter = useCallback(() => {
    hoverTimerRef.current = setTimeout(() => setShowDeleteBtn(true), 700);
  }, []);

  const handleHeaderMouseLeave = useCallback(() => {
    setShowDeleteBtn(false);
    if (hoverTimerRef.current) { clearTimeout(hoverTimerRef.current); hoverTimerRef.current = null; }
  }, []);

  useEffect(() => () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
  }, []);

  // ── Drag-to-reorder checklist items
  const handleDragStart = useCallback((stepIndex: number) => {
    setDragFrom(stepIndex);
    setDragOver(stepIndex);
    dragFromRef.current = stepIndex;
    dragOverRef.current = stepIndex;

    const onMove = (ev: MouseEvent) => {
      if (!stepsRef.current) return;
      const rect = stepsRef.current.getBoundingClientRect();
      const relY = ev.clientY - rect.top;
      const stepH = 38;
      const toIdx = Math.max(0, Math.min(task.steps.length - 1, Math.floor(relY / stepH)));
      dragOverRef.current = toIdx;
      setDragOver(toIdx);
    };

    const onUp = () => {
      const from = dragFromRef.current;
      const over = dragOverRef.current;
      if (from !== null && over !== null && from !== over) {
        reorderSteps(task.id, from, over);
      }
      dragFromRef.current = null;
      dragOverRef.current = null;
      setDragFrom(null);
      setDragOver(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [task.steps.length, task.id, reorderSteps]);

  return (
    <>
      <motion.div
        className={`task-card ${task.completed ? 'done' : ''} ${isExpanded ? 'expanded' : ''} ${isDraggingTask ? 'task-dragging' : ''} ${isDropTargetTask ? 'task-drop-target' : ''} ${showDeleteBtn ? 'drag-ready' : ''}`}
        data-task-id={task.id}
        layout
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.18 }}
        onContextMenu={handleContextMenu}
        onMouseDown={handleCardMouseDown}
      >
        {/* ── Card Header ── */}
        <div
          className="task-card-header"
          onClick={() => {
            if (wasDraggingRef.current) { wasDraggingRef.current = false; return; }
            if (!editingTitle && !confirmDelete) onExpand();
          }}
          onMouseEnter={handleHeaderMouseEnter}
          onMouseLeave={handleHeaderMouseLeave}
        >
          <motion.div
            className={`task-card-check ${task.completed ? 'done' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleTaskComplete(task.id); }}
            whileTap={{ scale: 0.85 }}
            animate={task.completed ? { scale: [1, 1.22, 1] } : { scale: 1 }}
            transition={{ duration: 0.2 }}
            title={task.completed ? 'Mark incomplete' : 'Complete all'}
          >
            {task.completed && (
              <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                <path d="M1 3.5L3.2 6L8 1" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
          </motion.div>

          <div className="task-card-info">
            {editingTitle ? (
              <input
                ref={titleRef}
                className="task-title-input"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.preventDefault(); commitTitle(); }
                  if (e.key === 'Escape') { setTitleDraft(task.title); setEditingTitle(false); }
                }}
                onBlur={commitTitle}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              /* Mod 24: narrow hit area — only the text itself triggers edit */
              <span
                className="task-card-title"
                onDoubleClick={(e) => { e.stopPropagation(); setEditingTitle(true); setTitleDraft(task.title); }}
                title="Double-click to edit"
              >
                {task.title}
              </span>
            )}
            <div className="task-card-meta">
              {task.deadline && (
                <span className={overdue ? 'overdue' : ''}>{fmtDeadline(task.deadline)}</span>
              )}
              {prog && (
                <span className={`prog-pill ${task.completed ? 'done' : ''}`}>
                  {prog.done}/{prog.total}
                </span>
              )}
            </div>
          </div>

          {/* Mod 26: inline delete confirmation */}
          {confirmDelete ? (
            <div className="delete-confirm" onClick={(e) => e.stopPropagation()}>
              <button className="delete-confirm-yes" onClick={() => { deleteTask(task.id); }}>✓</button>
              <button className="delete-confirm-no" onClick={() => setConfirmDelete(false)}>✕</button>
            </div>
          ) : (
            <div className="task-card-actions">
              {/* Mod 25: delayed hover delete icon */}
              <AnimatePresence>
                {showDeleteBtn && (
                  <motion.button
                    className="task-outer-delete"
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.7 }}
                    transition={{ duration: 0.15 }}
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                    title="Delete task"
                  >
                    <svg width="10" height="12" viewBox="0 0 10 12" fill="none">
                      <path d="M1 2.5h8M3.5 2.5V1.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M2 2.5l.55 7.5a.5.5 0 00.5.5h3.9a.5.5 0 00.5-.5L8 2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </motion.button>
                )}
              </AnimatePresence>
              <motion.div
                className="expand-chevron"
                animate={{ rotate: isExpanded ? 180 : 0 }}
                transition={{ duration: 0.2 }}
              >
                <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
                  <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </motion.div>
            </div>
          )}
        </div>

        {/* ── Expanded Checklist ── */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              className="task-card-steps"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              style={{ overflow: 'hidden' }}
            >
              <div ref={stepsRef}>
                <AnimatePresence>
                  {task.steps.map((step, idx) => (
                    <ChecklistRow
                      key={step.id}
                      step={step}
                      index={idx}
                      onToggle={() => toggleStep(task.id, step.id)}
                      onDelete={() => deleteStep(task.id, step.id)}
                      onRename={(title) => updateStep(task.id, step.id, { title })}
                      onDragStart={() => handleDragStart(idx)}
                      isDragging={dragFrom === idx}
                      isDropTarget={dragOver === idx && dragFrom !== null && dragFrom !== idx}
                    />
                  ))}
                </AnimatePresence>
              </div>

              {addingItem ? (
                <div className="inline-step-row" style={{ paddingLeft: 8 }}>
                  <div style={{ width: 18, height: 18, flexShrink: 0 }} />
                  <input
                    ref={itemRef}
                    className="add-step-inline-input"
                    placeholder={t.newItemPlaceholder}
                    value={itemValue}
                    onChange={(e) => setItemValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const v = itemValue.trim();
                        if (v) {
                          addStep(task.id, { title: v, checked: false });
                          setItemValue('');
                          // keep input open — focus stays for next step
                        } else {
                          setAddingItem(false);
                        }
                      }
                      if (e.key === 'Escape') { setAddingItem(false); setItemValue(''); }
                    }}
                    onBlur={commitItem}
                  />
                </div>
              ) : (
                <div className="card-footer-row">
                  <button className="add-step-btn-inline" onClick={() => setAddingItem(true)}>
                    {t.addChecklist}
                  </button>
                  <button
                    className="delete-task-btn"
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(true); }}
                  >
                    <svg width="11" height="13" viewBox="0 0 11 13" fill="none">
                      <path d="M1 2.5h9M4 2.5V1.5a.5.5 0 01.5-.5h2a.5.5 0 01.5.5v1M2 2.5l.6 8a.5.5 0 00.5.5h4.8a.5.5 0 00.5-.5l.6-8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              )}

              {prog && prog.total > 0 && (
                <div className="card-progress-bar">
                  <motion.div
                    className="card-progress-fill"
                    animate={{ width: `${prog.pct}%` }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Context menu portal */}
      <AnimatePresence>
        {ctxMenu && (
          <ContextMenu
            x={ctxMenu.x}
            y={ctxMenu.y}
            onArchive={() => archiveTask(task.id)}
            onDelete={() => { setCtxMenu(null); setConfirmDelete(true); }}
            onClose={() => setCtxMenu(null)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main TaskList View ───────────────────────────────────────────────────────

export function TaskList() {
  const tasks            = useStore((s) => s.tasks);
  const addTask          = useStore((s) => s.addTask);
  const deleteTask       = useStore((s) => s.deleteTask);
  const clearAllTasks    = useStore((s) => s.clearAllTasks);
  const setView          = useStore((s) => s.setView);
  const reorderTaskItems = useStore((s) => s.reorderTaskItems);

  const [addingTask, setAddingTask]         = useState(false);
  const [expandedId, setExpandedId]         = useState<string | null>(null);
  const [autoAddItemId, setAutoAddItemId]   = useState<string | null>(null);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Mod 40: task drag state
  const taskDragFromRef = useRef<string | null>(null);
  const taskDragOverRef = useRef<string | null>(null);
  const [taskDragFromId, setTaskDragFromId] = useState<string | null>(null);
  const [taskDragOverId, setTaskDragOverId] = useState<string | null>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  const t = useT();
  const autoSortCompleted = useStore((s) => s.settings.autoSortCompleted);

  // Click-outside: collapse expanded task when clicking outside its card
  useEffect(() => {
    if (!expandedId) return;
    const handler = (e: MouseEvent) => {
      const expanded = taskListRef.current?.querySelector<HTMLElement>(`[data-task-id="${expandedId}"]`);
      if (expanded && !expanded.contains(e.target as Node)) {
        setExpandedId(null);
      }
    };
    document.addEventListener('mousedown', handler, true);
    return () => document.removeEventListener('mousedown', handler, true);
  }, [expandedId]);
  // ── Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta    = e.metaKey || e.ctrlKey;
      const inInput = ['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName) ||
                      (e.target as HTMLElement).isContentEditable;

      // Esc: close expanded task or cancel new-task row before App.tsx hides the popup
      if (e.key === 'Escape') {
        if (expandedId) { e.stopImmediatePropagation(); setExpandedId(null); return; }
        if (addingTask)  { e.stopImmediatePropagation(); setAddingTask(false); return; }
        if (confirmClearAll) { e.stopImmediatePropagation(); setConfirmClearAll(false); return; }
        return;
      }

      if (inInput) return;

      // Cmd+Shift+Backspace: clear all tasks
      if (meta && e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        setConfirmClearAll(true);
        return;
      }

      // Cmd+Backspace: delete expanded task (moves to trash, recoverable)
      if (meta && !e.shiftKey && e.key === 'Backspace') {
        e.preventDefault();
        if (expandedId) { deleteTask(expandedId); setExpandedId(null); }
        return;
      }

      // Cmd+Enter: new task
      if (meta && e.key === 'Enter') {
        e.preventDefault();
        if (!addingTask) setAddingTask(true);
        return;
      }
    };

    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [expandedId, addingTask, confirmClearAll, deleteTask, clearAllTasks]);

  const active = tasks.filter((task) => !task.archived && !task.trashed);
  // Mod 47: respect autoSortCompleted setting
  const completed = active.filter(task => task.completed);
  const sorted = autoSortCompleted
    ? [...active.filter(task => !task.completed), ...completed]
    : active; // Mod 48: preserve full manual order when auto-sort is OFF

  const handleSaveTask = (title: string) => {
    const newId = addTask({ title, steps: [] });
    setAddingTask(false);
    setExpandedId(newId);      // Mod 41: auto-expand
    setAutoAddItemId(newId);   // Mod 39: auto-open checklist input
  };

  // Mod 40: task drag handler
  const handleTaskDragStart = useCallback((taskId: string) => {
    taskDragFromRef.current = taskId;
    taskDragOverRef.current = taskId;
    setTaskDragFromId(taskId);
    setTaskDragOverId(taskId);

    const onMove = (ev: MouseEvent) => {
      if (!taskListRef.current) return;
      const cards = Array.from(taskListRef.current.querySelectorAll<HTMLElement>('.task-card'));
      let closestId = taskId;
      let closestDist = Infinity;
      cards.forEach((card) => {
        const id = card.dataset.taskId;
        // Mod 48: when auto-sort is ON, block dropping onto completed section
        if (!id || (autoSortCompleted && !!completed.find(t => t.id === id))) return;
        const rect = card.getBoundingClientRect();
        const dist = Math.abs(ev.clientY - (rect.top + rect.height / 2));
        if (dist < closestDist) { closestDist = dist; closestId = id; }
      });
      taskDragOverRef.current = closestId;
      setTaskDragOverId(closestId);
    };

    const onUp = () => {
      const fromId = taskDragFromRef.current;
      const toId   = taskDragOverRef.current;
      if (fromId && toId && fromId !== toId) reorderTaskItems(fromId, toId);
      taskDragFromRef.current = null;
      taskDragOverRef.current = null;
      setTaskDragFromId(null);
      setTaskDragOverId(null);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [completed, reorderTaskItems, autoSortCompleted]);

  return (
    <div className="view">
      {/* Mod 23: data-tauri-drag-region makes header draggable */}
      <div className="header" data-tauri-drag-region>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }} data-tauri-drag-region>
          <div className="header-title" data-tauri-drag-region>{t.myTasks}</div>
          <Waveform />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
        <button className="icon-btn" onClick={() => setView('archive')} title="Archive">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M21 8v13H3V8" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M23 3H1v5h22V3z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M10 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
          </svg>
        </button>
        <button className="icon-btn" onClick={() => setView('settings')} title="Settings">
          <svg width="16" height="16" viewBox="0 0 21.2598 20.8887" fill="currentColor">
            <path d="M9.46289 20.8789L11.4355 20.8789C12.1875 20.8789 12.7734 20.4199 12.9395 19.6973L13.3594 17.8711L13.6719 17.7637L15.2637 18.7402C15.8984 19.1309 16.6309 19.043 17.168 18.5059L18.5352 17.1484C19.0723 16.6113 19.1602 15.8691 18.7695 15.2441L17.7734 13.6621L17.8906 13.3691L19.7168 12.9395C20.4297 12.7734 20.8984 12.1777 20.8984 11.4355L20.8984 9.50195C20.8984 8.75977 20.4395 8.17383 19.7168 7.99805L17.9102 7.55859L17.7832 7.24609L18.7793 5.66406C19.1699 5.03906 19.0918 4.30664 18.5449 3.75977L17.1777 2.39258C16.6504 1.86523 15.918 1.76758 15.2832 2.1582L13.6914 3.13477L13.3594 3.00781L12.9395 1.18164C12.7734 0.458984 12.1875 0 11.4355 0L9.46289 0C8.71094 0 8.125 0.458984 7.95898 1.18164L7.5293 3.00781L7.19727 3.13477L5.61523 2.1582C4.98047 1.76758 4.23828 1.86523 3.71094 2.39258L2.35352 3.75977C1.80664 4.30664 1.71875 5.03906 2.11914 5.66406L3.10547 7.24609L2.98828 7.55859L1.18164 7.99805C0.458984 8.17383 0 8.75977 0 9.50195L0 11.4355C0 12.1777 0.46875 12.7734 1.18164 12.9395L3.00781 13.3691L3.11523 13.6621L2.12891 15.2441C1.72852 15.8691 1.82617 16.6113 2.36328 17.1484L3.7207 18.5059C4.25781 19.043 5 19.1309 5.63477 18.7402L7.2168 17.7637L7.5293 17.8711L7.95898 19.6973C8.125 20.4199 8.71094 20.8789 9.46289 20.8789ZM9.61914 19.3555C9.45312 19.3555 9.36523 19.2871 9.33594 19.1309L8.75 16.709C8.1543 16.5625 7.59766 16.3281 7.17773 16.0645L5.04883 17.373C4.93164 17.4609 4.79492 17.4512 4.6875 17.3242L3.53516 16.1719C3.42773 16.0645 3.41797 15.9473 3.49609 15.8105L4.80469 13.7012C4.58008 13.291 4.32617 12.7344 4.16992 12.1387L1.74805 11.5625C1.5918 11.5332 1.52344 11.4453 1.52344 11.2793L1.52344 9.64844C1.52344 9.47266 1.58203 9.39453 1.74805 9.36523L4.16016 8.7793C4.31641 8.14453 4.60938 7.56836 4.78516 7.20703L3.48633 5.09766C3.39844 4.95117 3.4082 4.83398 3.51562 4.7168L4.67773 3.58398C4.79492 3.4668 4.90234 3.45703 5.04883 3.53516L7.1582 4.81445C7.57812 4.58008 8.17383 4.33594 8.75977 4.16992L9.33594 1.74805C9.36523 1.5918 9.45312 1.52344 9.61914 1.52344L11.2793 1.52344C11.4453 1.52344 11.5332 1.5918 11.5527 1.74805L12.1484 4.18945C12.7539 4.3457 13.2812 4.58984 13.7207 4.82422L15.8398 3.53516C15.9961 3.45703 16.0938 3.4668 16.2207 3.58398L17.373 4.7168C17.4902 4.83398 17.4902 4.95117 17.4023 5.09766L16.1035 7.20703C16.2891 7.56836 16.5723 8.14453 16.7285 8.7793L19.1504 9.36523C19.3066 9.39453 19.375 9.47266 19.375 9.64844L19.375 11.2793C19.375 11.4453 19.2969 11.5332 19.1504 11.5625L16.7188 12.1387C16.5625 12.7344 16.3184 13.291 16.084 13.7012L17.3926 15.8105C17.4707 15.9473 17.4707 16.0645 17.3535 16.1719L16.2109 17.3242C16.0938 17.4512 15.9668 17.4609 15.8398 17.373L13.7109 16.0645C13.291 16.3281 12.7441 16.5625 12.1484 16.709L11.5527 19.1309C11.5332 19.2871 11.4453 19.3555 11.2793 19.3555ZM10.4492 14.1602C12.5098 14.1602 14.1699 12.5 14.1699 10.4395C14.1699 8.37891 12.5098 6.71875 10.4492 6.71875C8.38867 6.71875 6.72852 8.37891 6.72852 10.4395C6.72852 12.5 8.38867 14.1602 10.4492 14.1602ZM10.4492 12.6465C9.22852 12.6465 8.24219 11.6602 8.24219 10.4395C8.24219 9.21875 9.22852 8.23242 10.4492 8.23242C11.6699 8.23242 12.6562 9.21875 12.6562 10.4395C12.6562 11.6602 11.6699 12.6465 10.4492 12.6465Z"/>
          </svg>
        </button>
        </div>
      </div>

      <div className="task-list" ref={taskListRef}>
        <AnimatePresence>
          {addingTask && (
            <NewTaskRow
              onSave={handleSaveTask}
              onCancel={() => setAddingTask(false)}
            />
          )}
        </AnimatePresence>

        {sorted.length === 0 && !addingTask ? (
          <div className="task-list-empty">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <rect x="7" y="9" width="24" height="3" rx="1.5" fill="currentColor" opacity=".25"/>
              <rect x="7" y="17" width="16" height="3" rx="1.5" fill="currentColor" opacity=".25"/>
              <rect x="7" y="25" width="20" height="3" rx="1.5" fill="currentColor" opacity=".25"/>
            </svg>
            <div className="empty-hint">{t.tapToAdd}</div>
          </div>
        ) : (
          <AnimatePresence>
            {sorted.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                isExpanded={expandedId === task.id}
                onExpand={() => setExpandedId(id => id === task.id ? null : task.id)}
                autoAddItem={autoAddItemId === task.id}
                onTaskDragStart={() => handleTaskDragStart(task.id)}
                isDraggingTask={taskDragFromId === task.id}
                isDropTargetTask={taskDragOverId === task.id && taskDragFromId !== null && taskDragFromId !== task.id}
              />
            ))}
          </AnimatePresence>
        )}
      </div>

      <div className="toolbar">
        {confirmClearAll ? (
          <div className="delete-confirm" style={{ direction: 'ltr', width: '100%', justifyContent: 'center', gap: 10 }} onClick={(e) => e.stopPropagation()}>
            <span className="delete-confirm-text">Clear all tasks?</span>
            <button className="delete-confirm-yes" onClick={() => { clearAllTasks(); setConfirmClearAll(false); }}>✓</button>
            <button className="delete-confirm-no"  onClick={() => setConfirmClearAll(false)}>✕</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 12, color: 'var(--text3)' }}>
              {t.remaining(active.filter((task) => !task.completed).length)}
            </div>
            <motion.button
              className="fab"
              onClick={() => setAddingTask(true)}
              whileTap={{ scale: 0.9 }}
              title="New task"
            >
              <svg width="17" height="17" viewBox="0 0 23.6475 23.3041" fill="currentColor">
                <path d="M17.0714 3.37706L15.5591 4.88935L7.07275 4.88935C5.47119 4.88935 4.56299 5.79755 4.56299 7.39912L4.56299 16.5397C4.56299 18.1511 5.47119 19.0495 7.07275 19.0495L16.2134 19.0495C17.8247 19.0495 18.7231 18.1511 18.7231 16.5397L18.7231 8.12957L20.2422 6.60772C20.2787 6.85929 20.2954 7.12741 20.2954 7.40888L20.2954 16.5397C20.2954 19.1667 18.8403 20.6218 16.2134 20.6218L7.07275 20.6218C4.45557 20.6218 2.99072 19.1667 2.99072 16.5397L2.99072 7.40888C2.99072 4.78193 4.45557 3.31708 7.07275 3.31708L16.2134 3.31708C16.5157 3.31708 16.8024 3.33648 17.0714 3.37706Z"/>
                <path d="M9.61182 14.2936L11.5161 13.4636L20.6372 4.35224L19.2993 3.03388L10.188 12.1452L9.30908 13.9811C9.23096 14.1472 9.42627 14.3718 9.61182 14.2936ZM21.3599 3.63935L22.063 2.91669C22.395 2.56513 22.395 2.09638 22.063 1.77412L21.8384 1.53974C21.5356 1.23701 21.0571 1.27607 20.7349 1.58857L20.022 2.29169Z"/>
              </svg>
            </motion.button>
          </>
        )}
      </div>
    </div>
  );
}
