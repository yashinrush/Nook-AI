import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
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
  onDropComplete?: () => void;
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
    return <ImageIcon size={26} color="#34d399" />;
  }
  if (type.startsWith('video/') || ['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) {
    return <Video size={26} color="#fbbf24" />;
  }
  if (type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg'].includes(ext)) {
    return <Music size={26} color="#c084fc" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz', 'iso'].includes(ext)) {
    return <FileArchive size={26} color="#fb923c" />;
  }
  if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css', 'cpp', 'c', 'java', 'go'].includes(ext)) {
    return <FileCode size={26} color="#22d3ee" />;
  }
  if (['xls', 'xlsx', 'csv'].includes(ext)) {
    return <FileSpreadsheet size={26} color="#10b981" />;
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'rtf'].includes(ext)) {
    return <FileText size={26} color="#fb7185" />;
  }
  return <File size={26} color="#60a5fa" />;
}

export const FileShelf: React.FC<FileShelfProps> = ({
  onBack,
  className = '',
  isDraggingExternal = false,
  onDropComplete,
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
  const dragCounterRef = useRef(0);
  const dropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
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

  // Drop handlers
  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    setIsHoveringDrop(true);
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
    dragCounterRef.current--;
    if (dragCounterRef.current <= 0) {
      dragCounterRef.current = 0;
      setIsHoveringDrop(false);
    }
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current = 0;
    setIsHoveringDrop(false);
    onDropComplete?.();

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
  }, [onDropComplete]);

  // Is actively dragging files right over the shelf area
  const isActivelyDraggingOver = isHoveringDrop || (isDraggingExternal && items.length === 0);

  return (
    <div
      ref={dropRef}
      className={`nook-file-shelf-container ${className}`}
      onClick={(e) => e.stopPropagation()}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '8px 12px 6px',
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
          background: rgba(255, 255, 255, 0.22);
          border-radius: 4px;
        }
        .shelf-cards-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.4);
        }
      `}</style>

      {/* Header Row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingBottom: '6px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
          flexShrink: 0,
        }}
      >
        {/* Left: Back button + Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {onBack && (
            <motion.button
              onClick={onBack}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              style={{
                width: '22px',
                height: '22px',
                borderRadius: '50%',
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                flexShrink: 0,
                padding: 0,
              }}
              title="Back (or scroll to exit)"
            >
              <ChevronLeft size={15} />
            </motion.button>
          )}

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, letterSpacing: '-0.01em', color: '#ffffff' }}>
              File<span style={{ color: '#22c55e' }}>Shelf</span>
            </span>
            <span
              style={{
                fontSize: '9px',
                padding: '1.5px 6px',
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

        {/* Right: Actions and Exit hint cleanly aligned */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.45)', fontWeight: 500 }}>
            Scroll to switch
          </span>
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

      {/* Main Body: File Shelf Cards List (Always Visible) or Empty State */}
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
        {items.length === 0 ? (
          /* Empty State Drop Zone */
          <motion.div
            key="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              width: '100%',
              height: '100%',
              border: isActivelyDraggingOver ? '2px dashed #22c55e' : '1px dashed rgba(255, 255, 255, 0.12)',
              borderRadius: '14px',
              backgroundColor: isActivelyDraggingOver ? 'rgba(34, 197, 94, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              transition: 'all 0.15s ease',
            }}
          >
            {isActivelyDraggingOver ? (
              <>
                <ArrowDownCircle size={32} color="#22c55e" />
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>
                  Release to Drop on Shelf
                </div>
              </>
            ) : (
              <>
                <FolderOpen size={28} color="rgba(255, 255, 255, 0.4)" />
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                    Drop Zone Ready
                  </div>
                  <div style={{ fontSize: '10.5px', color: 'rgba(255, 255, 255, 0.45)', marginTop: '2px' }}>
                    Drag files to notch from Explorer, or click Add
                  </div>
                </div>
              </>
            )}
          </motion.div>
        ) : (
          /* Cards Grid: Always renders your items! */
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <div
              className="shelf-cards-scroll"
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
                    width: '92px',
                    minWidth: '92px',
                    height: '116px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '6px 6px 4px',
                    cursor: 'grab',
                    position: 'relative',
                    overflow: 'hidden',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.15s ease, background-color 0.15s ease',
                  }}
                >
                  {/* Remove Button */}
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
                      height: '46px',
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
                  <div
                    style={{
                      width: '100%',
                      overflow: 'hidden',
                      textAlign: 'center',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: '3px',
                      marginBottom: '2px',
                    }}
                  >
                    <div
                      style={{
                        width: '100%',
                        fontSize: '10.5px',
                        fontWeight: 600,
                        color: '#ffffff',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        textAlign: 'center',
                        lineHeight: '1.25',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </div>
                    {item.size > 0 ? (
                      <div
                        style={{
                          fontSize: '8.5px',
                          color: 'rgba(255, 255, 255, 0.5)',
                          marginTop: '2px',
                          lineHeight: '1.1',
                          textAlign: 'center',
                        }}
                      >
                        {formatFileSize(item.size)}
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '8.5px',
                          color: '#4ade80',
                          marginTop: '2px',
                          fontWeight: 500,
                          lineHeight: '1.1',
                          textAlign: 'center',
                        }}
                      >
                        Ready
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
            </div>

            {/* Subtle Overlay only when dragging more files over existing items */}
            {isHoveringDrop && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '14px',
                  border: '2px dashed #22c55e',
                  backgroundColor: 'rgba(34, 197, 94, 0.12)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  pointerEvents: 'none',
                  zIndex: 10,
                }}
              >
                <ArrowDownCircle size={24} color="#22c55e" />
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#22c55e' }}>
                  Drop to Add More Files
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Hint Footer */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: '6px',
          fontSize: '10px',
          color: 'rgba(255, 255, 255, 0.45)',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          flexShrink: 0,
          boxSizing: 'border-box',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          💡 Drag cards out to drop into apps • Scroll to switch
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, marginLeft: '8px' }}>
          <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
          <span style={{ width: '12px', height: '3.5px', borderRadius: '2px', background: '#22c55e' }} />
        </div>
      </div>
    </div>
  );
};
