import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';

export function Trash() {
  const tasks = useStore((s) => s.tasks);
  const setView = useStore((s) => s.setView);
  const restoreFromTrash = useStore((s) => s.restoreFromTrash);
  const permanentDeleteTask = useStore((s) => s.permanentDeleteTask);
  const emptyTrash = useStore((s) => s.emptyTrash);
  const t = useT();

  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const trashed = tasks.filter((task) => task.trashed);

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
          {t.trashTitle}
        </div>
        {trashed.length > 0 && (
          <div style={{ marginRight: 4 }}>
            {confirmEmpty ? (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="archive-action-btn danger"
                  onClick={() => { emptyTrash(); setConfirmEmpty(false); }}
                  title="Confirm"
                >
                  <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
                    <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
                <button
                  className="archive-action-btn"
                  onClick={() => setConfirmEmpty(false)}
                  title="Cancel"
                >
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                    <path d="M1 1l7 7M8 1L1 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </button>
              </div>
            ) : (
              <button
                className="archive-action-btn danger"
                onClick={() => setConfirmEmpty(true)}
                title={t.emptyTrash}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  <path d="M10 10v6M14 10v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="task-list" style={{ paddingTop: 4 }}>
        {trashed.length === 0 ? (
          <div className="task-list-empty">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <path d="M8 12h22M14 12V9a2 2 0 012-2h6a2 2 0 012 2v3M10 12l1.5 18a2 2 0 002 1.8h13a2 2 0 002-1.8L30 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" strokeOpacity=".3"/>
              <path d="M16 18v8M19 18v8M22 18v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeOpacity=".3"/>
            </svg>
            <div className="empty-hint">{t.trashEmpty}</div>
          </div>
        ) : (
          <AnimatePresence>
            {trashed.map((task) => (
              <motion.div
                key={task.id}
                className="archive-row"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, height: 0, marginTop: 0, marginBottom: 0, overflow: 'hidden' }}
                transition={{ duration: 0.18 }}
              >
                <div className="archive-row-content">
                  <div className="archive-row-title">{task.title}</div>
                  {task.trashedAt && (
                    <div className="archive-row-date">
                      {new Date(task.trashedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
                <div className="archive-row-actions">
                  <button
                    className="archive-action-btn"
                    onClick={() => restoreFromTrash(task.id)}
                    title={t.restore}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="archive-action-btn danger"
                    onClick={() => permanentDeleteTask(task.id)}
                    title={t.deleteForever}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </motion.div>
  );
}
