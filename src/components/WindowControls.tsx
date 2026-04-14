export function WindowControls() {
  const handleClose = async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    invoke('hide_popup');
  };

  const handleMinimize = async () => {
    const { getCurrentWindow } = await import('@tauri-apps/api/window');
    getCurrentWindow().minimize();
  };

  return (
    <div className="win-controls">
      <button className="win-btn win-close" onClick={handleClose} title="Hide">
        <span className="win-glyph">✕</span>
      </button>
      <button className="win-btn win-minimize" onClick={handleMinimize} title="Minimize">
        <span className="win-glyph">−</span>
      </button>
      <button className="win-btn win-zoom" title="" tabIndex={-1}>
        <span className="win-glyph" style={{ opacity: 0 }} />
      </button>
    </div>
  );
}
