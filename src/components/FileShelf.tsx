import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  Music,
  Video,
  Image as ImageIcon,
  File,
  X,
  Trash2,
  FolderOpen,
  Copy,
  ExternalLink,
  ChevronLeft,
  Plus,
  ArrowDownCircle,
  Check,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { open as openDialog } from '@tauri-apps/plugin-dialog';

export interface ShelfItem {
  id: string;
  name: string;
  path: string;
  size: number;
  type: string;
  previewUrl?: string;
  addedAt: number;
}

interface FileShelfProps {
  onBack?: () => void;
  className?: string;
  isDraggingExternal?: boolean;
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function getFileIcon(name: string, type: string) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (type.startsWith('image/') || ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'ico'].includes(ext)) {
    return <ImageIcon size={22} className="text-emerald-400" color="#34d399" />;
  }
  if (type.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
    return <Video size={22} className="text-amber-400" color="#fbbf24" />;
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) {
    return <Music size={22} className="text-purple-400" color="#c084fc" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) {
    return <FileArchive size={22} className="text-orange-400" color="#fb923c" />;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'cpp', 'c', 'java', 'go'].includes(ext)) {
    return <FileCode size={22} className="text-cyan-400" color="#22d3ee" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={22} className="text-emerald-500" color="#10b981" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) {
    return <FileText size={22} className="text-rose-400" color="#fb7185" />;
  }
  return <File size={22} className="text-blue-400" color="#60a5fa" />;
}

export const FileShelf: React.FC<FileShelfProps> = ({
  onBack,
  className = '',
  isDraggingExternal = false,
}) => {
  const [items, setItems] = useState<ShelfItem[]>(() => {
    try {
      const saved = localStorage.getItem('nook-shelf-items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [isHoveringDrop, setIsHoveringDrop] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      // Filter out ephemeral blob preview URLs before saving to localStorage
      const storable = items.map(item => ({
        ...item,
        previewUrl: item.previewUrl && !item.previewUrl.startsWith('blob:') ? item.previewUrl : undefined,
      }));
      localStorage.setItem('nook-shelf-items', JSON.stringify(storable));
    } catch {}
  }, [items]);

  const handleAddFiles = useCallback(async () => {
    try {
      const selected = await openDialog({
        multiple: true,
        title: 'Select Files for Nook Shelf',
      });
      if (!selected) return;

      const filePaths = Array.isArray(selected) ? selected : [selected];
      const newItems: ShelfItem[] = filePaths.map((filePath) => {
        const parts = filePath.replace(/\\/g, '/').split('/');
        const name = parts[parts.length - 1] || filePath;
        const ext = name.split('.').pop()?.toLowerCase() || '';
        return {
          id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          name,
          path: filePath,
          size: 0,
          type: ext ? `file/${ext}` : 'file',
          addedAt: Date.now(),
        };
      });

      setItems((prev) => [...newItems, ...prev]);
    } catch (err) {
      console.error('Error opening dialog:', err);
    }
  }, []);

  const handleRemove = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const handleClearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setItems([]);
  }, []);

  const handleOpen = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!path) return;
    invoke('open_file_path', { path }).catch(() => {
      // Fallback: opener
      import('@tauri-apps/plugin-opener').then((opener) => {
        opener.openPath(path).catch(() => {});
      }).catch(() => {});
    });
  }, []);

  const handleShowInFolder = useCallback((path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!path) return;
    invoke('show_in_folder', { path }).catch(() => {});
  }, []);

  const handleCopyPath = useCallback((item: ShelfItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = item.path || item.name;
    navigator.clipboard.writeText(textToCopy).then(() => {
      setCopiedId(item.id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  }, []);

  const handleCardDragStart = useCallback(async (item: ShelfItem, e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', item.path || item.name);
    e.dataTransfer.effectAllowed = 'copyMove';

    // If native drag plugin is available and we have absolute path, trigger native OS drag
    if (item.path) {
      try {
        const { startDrag } = await import('@crabnebula/tauri-plugin-drag');
        startDrag({
          item: [item.path],
          icon: '',
        });
      } catch {}
    }
  }, []);

  // Internal Drop Zone Handlers (inside the component)
  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHoveringDrop(false);

    const files = Array.from(e.dataTransfer.files);
    if (!files || files.length === 0) return;

    const newItems: ShelfItem[] = files.map((file) => {
      const fullPath = (file as any).path || '';
      const isImg = file.type.startsWith('image/');
      let previewUrl: string | undefined = undefined;
      if (isImg) {
        try {
          previewUrl = URL.createObjectURL(file);
        } catch {}
      }

      return {
        id: `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        name: file.name,
        path: fullPath,
        size: file.size,
        type: file.type || 'file',
        previewUrl,
        addedAt: Date.now(),
      };
    });

    setItems((prev) => [...newItems, ...prev]);
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
    setIsHoveringDrop(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsHoveringDrop(false);
  }, []);

  const isDropping = isHoveringDrop || isDraggingExternal;

  return (
    <div
      ref={dropRef}
      className={`nook-file-shelf-container ${className}`}
      onClick={(e) => e.stopPropagation()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 16px 10px',
        color: '#eceff7',
        userSelect: 'none',
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      <style>{`
        .shelf-cards-scroll::-webkit-scrollbar {
          height: 4px;
          width: 4px;
        }
        .shelf-cards-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .shelf-cards-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.2);
          border-radius: 4px;
        }
        .shelf-cards-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.35);
        }
      `}</style>

      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingBottom: '8px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        {/* Left: Back button + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.92 }}
              style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
              }}
              title="Back"
            >
              <ChevronLeft size={15} />
            </motion.button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff' }}>
              File<span style={{ color: '#22c55e' }}>Shelf</span>
            </span>
            <span
              style={{
                fontSize: '10.5px',
                padding: '1px 6px',
                borderRadius: '999px',
                backgroundColor: items.length > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                color: items.length > 0 ? '#4ade80' : 'rgba(255, 255, 255, 0.6)',
                fontWeight: 600,
              }}
            >
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>
        </div>

        {/* Center Hint */}
        <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.5)', fontWeight: 500 }}>
          Drag files here to stash
        </div>

        {/* Right: Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <motion.button
            onClick={handleAddFiles}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '999px',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
            title="Browse and add files"
          >
            <Plus size={11} strokeWidth={2.8} /> Add
          </motion.button>

          {items.length > 0 && (
            <motion.button
              onClick={handleClearAll}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                padding: '3px 8px',
                borderRadius: '999px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#f87171',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
              title="Clear all files from shelf"
            >
              <Trash2 size={11} /> Clear
            </motion.button>
          )}
        </div>
      </div>

      {/* Main Body: Active Drop Target OR File Shelf Carousel */}
      <div
        style={{
          flex: 1,
          width: '100%',
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '6px 0',
        }}
      >
        <AnimatePresence mode="wait">
          {isDropping ? (
            <motion.div
              key="drop-overlay"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                backgroundColor: 'rgba(34, 197, 94, 0.08)',
                border: '2px dashed #22c55e',
                borderRadius: '16px',
                zIndex: 10,
              }}
            >
              <motion.div
                animate={{ y: [0, 4, 0] }}
                transition={{ repeat: Infinity, duration: 1.2, ease: 'easeInOut' }}
              >
                <ArrowDownCircle size={36} color="#22c55e" />
              </motion.div>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#22c55e' }}>
                Release to Drop on Shelf
              </span>
              <span style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.6)' }}>
                Files will be saved in your quick stash
              </span>
            </motion.div>
          ) : items.length === 0 ? (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                height: '100%',
                border: '1px dashed rgba(255, 255, 255, 0.12)',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.02)',
              }}
            >
              <FolderOpen size={28} color="rgba(255, 255, 255, 0.4)" />
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                  Drop Zone Ready
                </div>
                <div style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '2px' }}>
                  Drag files to notch from Explorer, or click Add
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="items-grid"
              className="shelf-cards-scroll"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                display: 'flex',
                gap: '10px',
                overflowX: 'auto',
                overflowY: 'hidden',
                width: '100%',
                height: '100%',
                padding: '4px 2px',
                alignItems: 'center',
                boxSizing: 'border-box',
              }}
            >
              {items.map((item) => (
                <motion.div
                  key={item.id}
                  draggable
                  onDragStart={(e: any) => handleCardDragStart(item, e)}
                  whileHover={{ y: -3, scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  style={{
                    width: '102px',
                    minWidth: '102px',
                    height: '126px',
                    borderRadius: '12px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '8px 7px 6px',
                    cursor: 'grab',
                    position: 'relative',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  {/* Remove Button (top right) */}
                  <motion.button
                    onClick={(e) => handleRemove(item.id, e)}
                    whileHover={{ scale: 1.15 }}
                    whileTap={{ scale: 0.85 }}
                    style={{
                      position: 'absolute',
                      top: '4px',
                      right: '4px',
                      width: '18px',
                      height: '18px',
                      borderRadius: '50%',
                      backgroundColor: 'rgba(0, 0, 0, 0.65)',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      color: 'rgba(255, 255, 255, 0.75)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      padding: 0,
                      zIndex: 3,
                    }}
                    title="Remove from shelf"
                  >
                    <X size={10} />
                  </motion.button>

                  {/* Icon or Thumbnail Preview */}
                  <div
                    style={{
                      width: '100%',
                      height: '52px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: '8px',
                      backgroundColor: 'rgba(0, 0, 0, 0.3)',
                      overflow: 'hidden',
                      marginTop: '2px',
                    }}
                  >
                    {item.previewUrl ? (
                      <img
                        src={item.previewUrl}
                        alt=""
                        draggable={false}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                      />
                    ) : (
                      getFileIcon(item.name, item.type)
                    )}
                  </div>

                  {/* Title & Size */}
                  <div style={{ width: '100%', overflow: 'hidden' }}>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    {item.size > 0 && (
                      <div style={{ fontSize: '9.5px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '1px' }}>
                        {formatFileSize(item.size)}
                      </div>
                    )}
                  </div>

                  {/* Quick Action Icons Row */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      paddingTop: '2px',
                      borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                    }}
                  >
                    <motion.button
                      onClick={(e) => handleCopyPath(item, e)}
                      whileHover={{ scale: 1.15 }}
                      whileTap={{ scale: 0.9 }}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: copiedId === item.id ? '#22c55e' : 'rgba(255, 255, 255, 0.55)',
                        cursor: 'pointer',
                        padding: '1px',
                        display: 'flex',
                        alignItems: 'center',
                      }}
                      title="Copy path"
                    >
                      {copiedId === item.id ? <Check size={11} strokeWidth={2.8} /> : <Copy size={11} />}
                    </motion.button>

                    {item.path && (
                      <motion.button
                        onClick={(e) => handleShowInFolder(item.path, e)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.55)',
                          cursor: 'pointer',
                          padding: '1px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Show in File Explorer"
                      >
                        <FolderOpen size={11} />
                      </motion.button>
                    )}

                    {item.path && (
                      <motion.button
                        onClick={(e) => handleOpen(item.path, e)}
                        whileHover={{ scale: 1.15 }}
                        whileTap={{ scale: 0.9 }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'rgba(255, 255, 255, 0.55)',
                          cursor: 'pointer',
                          padding: '1px',
                          display: 'flex',
                          alignItems: 'center',
                        }}
                        title="Open file"
                      >
                        <ExternalLink size={11} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Hint Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: '4px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.4)',
          borderTop: '1px solid rgba(255, 255, 255, 0.05)',
          flexShrink: 0,
        }}
      >
        <span>💡 Drag cards out to drop into Discord, browser, or folders</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ width: '12px', height: '3.5px', borderRadius: '2px', background: '#22c55e' }} />
        </div>
      </div>
    </div>
  );
};
