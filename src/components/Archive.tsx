import { motion, AnimatePresence } from 'framer-motion';
import { useStore } from '../store/useStore';
import { useT } from '../hooks/useT';

export function Archive() {
  const tasks = useStore((s) => s.tasks);
  const setView = useStore((s) => s.setView);
  const deleteTask = useStore((s) => s.deleteTask);
  const unarchiveTask = useStore((s) => s.unarchiveTask);
  const t = useT();

  const archived = tasks.filter((t) => t.archived && !t.trashed);

  return (
    <motion.div
      className="view"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="header" data-tauri-drag-region>
        <button className="detail-back" onClick={() => setView('tasks')}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <div className="header-title small" style={{ flex: 1, marginLeft: 10 }} data-tauri-drag-region>{t.archiveTitle}</div>
      </div>

      <div className="task-list" style={{ paddingTop: 4 }}>
        {archived.length === 0 ? (
          <div className="task-list-empty">
            <svg width="38" height="38" viewBox="0 0 38 38" fill="none">
              <rect x="5" y="10" width="28" height="20" rx="3" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".3"/>
              <path d="M5 15h28" stroke="currentColor" strokeWidth="1.5" strokeOpacity=".3"/>
              <rect x="14" y="19" width="10" height="2" rx="1" fill="currentColor" fillOpacity=".25"/>
            </svg>
            <div className="empty-hint">{t.archiveEmpty}</div>
          </div>
        ) : (
          <AnimatePresence>
            {archived.map((task) => (
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
                  {task.completedAt && (
                    <div className="archive-row-date">
                      {new Date(task.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </div>
                  )}
                </div>
                <div className="archive-row-actions">
                  <button
                    className="archive-action-btn"
                    onClick={() => unarchiveTask(task.id)}
                    title={t.restore}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    className="archive-action-btn danger"
                    onClick={() => deleteTask(task.id)}
                    title="Delete"
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
