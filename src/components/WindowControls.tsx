import { useEffect, useState } from "react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import "./WindowControls.css";

export function WindowControls() {
  const [focused, setFocused] = useState(true);
  const [isMaximized, setIsMaximized] = useState(false);
  const win = getCurrentWebviewWindow();

  useEffect(() => {
    const unlistenFocus = win.onFocusChanged(({ payload }) => setFocused(payload));
    const checkMax = async () => {
      try {
        setIsMaximized(await win.isMaximized());
      } catch {}
    };
    checkMax();
    const unlistenResize = win.onResized(checkMax);
    return () => {
      unlistenFocus.then((fn) => fn());
      unlistenResize.then((fn) => fn());
    };
  }, [win]);

  const handleToggleMaximize = async () => {
    try {
      await win.toggleMaximize();
      setIsMaximized(await win.isMaximized());
    } catch {}
  };

  return (
    <div className={`wc windows-controls ${focused ? "" : "blurred"}`}>
      <button
        className="wc-btn win-btn minimize"
        aria-label="Minimize"
        title="Minimize"
        onClick={() => win.minimize().catch(() => {})}
      >
        <svg width="10" height="1" viewBox="0 0 10 1">
          <rect width="10" height="1" fill="currentColor" />
        </svg>
      </button>

      <button
        className="wc-btn win-btn maximize"
        aria-label={isMaximized ? "Restore Down" : "Maximize"}
        title={isMaximized ? "Restore Down" : "Maximize"}
        onClick={handleToggleMaximize}
      >
        {isMaximized ? (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <path
              d="M 2.5,0.5 L 9.5,0.5 L 9.5,7.5 L 7.5,7.5 L 7.5,2.5 L 2.5,2.5 Z"
              fill="none"
              stroke="currentColor"
              strokeWidth="1"
            />
            <rect x="0.5" y="2.5" width="7" height="7" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 10 10">
            <rect x="0.5" y="0.5" width="9" height="9" fill="none" stroke="currentColor" strokeWidth="1" />
          </svg>
        )}
      </button>

      <button
        className="wc-btn win-btn close"
        aria-label="Close"
        title="Close"
        onClick={() => win.hide().catch(() => {})}
      >
        <svg width="10" height="10" viewBox="0 0 10 10">
          <line x1="0.5" y1="0.5" x2="9.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="9.5" y1="0.5" x2="0.5" y2="9.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
