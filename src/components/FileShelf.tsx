import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FolderDown,
  File,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileArchive,
  FileCode,
  Copy,
  Trash2,
  ExternalLink,
  Check,
  Inbox,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface ShelfItem {
  id: string;
  name: string;
  size: number;
  type: string;
  path?: string;
  addedAt: number;
}

interface FileShelfProps {
  compact?: boolean;
  onItemCountChange?: (count: number) => void;
  className?: string;
}

export const FileShelf: React.FC<FileShelfProps> = ({
  compact = false,
  onItemCountChange,
  className = '',
}) => {
  const [items, setItems] = useState<ShelfItem[]>(() => {
    try {
      const saved = localStorage.getItem('nectar-file-shelf');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    localStorage.setItem('nectar-file-shelf', JSON.stringify(items));
    onItemCountChange?.(items.length);
  }, [items, onItemCountChange]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const newItems: ShelfItem[] = Array.from(e.dataTransfer.files).map((f) => ({
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        name: f.name,
        size: f.size,
        type: f.type || f.name.split('.').pop() || '',
        path: (f as any).path, // File path available in Tauri/Electron WebView
        addedAt: Date.now(),
      }));

      setItems((prev) => [...newItems, ...prev]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const removeItem = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  const clearAll = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setItems([]);
  }, []);

  const copyPathOrName = useCallback((item: ShelfItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = item.path || item.name;
    navigator.clipboard.writeText(textToCopy);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1200);
  }, []);

  const openFile = useCallback((item: ShelfItem, e: React.MouseEvent) => {
    e.stopPropagation();
    if (item.path) {
      invoke('open_path', { path: item.path }).catch(() => {
        // Fallback opener
        import('@tauri-apps/plugin-opener').then(({ openPath }) => {
          if (item.path) openPath(item.path).catch(() => {});
        }).catch(() => {});
      });
    }
  }, []);

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const getFileIcon = (name: string, _type?: string) => {
    const ext = (name.split('.').pop() || '').toLowerCase();
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return <FileImage size={15} color="#38bdf8" />;
    if (['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a'].includes(ext)) return <FileAudio size={15} color="#a78bfa" />;
    if (['mp4', 'mkv', 'mov', 'avi', 'webm'].includes(ext)) return <FileVideo size={15} color="#f43f5e" />;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return <FileArchive size={15} color="#f59e0b" />;
    if (['js', 'ts', 'tsx', 'jsx', 'rs', 'py', 'json', 'html', 'css'].includes(ext)) return <FileCode size={15} color="#2dd4bf" />;
    if (['txt', 'md', 'pdf', 'doc', 'docx'].includes(ext)) return <FileText size={15} color="#60a5fa" />;
    return <File size={15} color="#94a3b8" />;
  };

  if (compact) {
    return (
      <div
        className="file-shelf-compact-chip"
        title={`File Shelf: ${items.length} items`}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '5px',
          padding: '2px 7px',
          borderRadius: '999px',
          backgroundColor: 'rgba(245, 158, 11, 0.12)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
          color: '#f59e0b',
          fontSize: '11px',
          fontWeight: 600,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <FolderDown size={11} strokeWidth={2.4} />
        <span>{items.length}</span>
      </div>
    );
  }

  return (
    <div
      className={`file-shelf-drawer ${className}`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: '220px',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px',
        color: '#eceff7',
        userSelect: 'none',
        borderRadius: '16px',
        border: isDragOver ? '2px dashed #19b8ff' : '1px solid transparent',
        backgroundColor: isDragOver ? 'rgba(25, 184, 255, 0.08)' : 'transparent',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <FolderDown size={14} color="#f59e0b" />
          <span style={{ fontSize: '13px', fontWeight: 700 }}>Quick File Shelf</span>
          <span style={{ fontSize: '11px', color: '#8c94a8' }}>({items.length})</span>
        </div>

        {items.length > 0 && (
          <button
            onClick={clearAll}
            style={{
              background: 'none',
              border: 'none',
              color: '#8c94a8',
              fontSize: '11px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
            title="Clear all files"
          >
            <Trash2 size={11} /> Clear
          </button>
        )}
      </div>

      {/* Files List or Drop Prompt */}
      {items.length === 0 ? (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            color: '#8c94a8',
            border: '1.5px dashed rgba(255, 255, 255, 0.14)',
            borderRadius: '12px',
            padding: '20px 10px',
            minHeight: '100px',
          }}
        >
          <Inbox size={24} strokeWidth={1.5} color="#8c94a8" />
          <span style={{ fontSize: '12px' }}>Drag and drop files here to stash</span>
          <span style={{ fontSize: '10px', opacity: 0.6 }}>Temporary holding shelf for quick access</span>
        </div>
      ) : (
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            scrollbarWidth: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
            maxHeight: '160px',
          }}
        >
          <AnimatePresence>
            {items.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                onClick={(e) => openFile(item, e)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  cursor: item.path ? 'pointer' : 'default',
                  transition: 'background 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                  {getFileIcon(item.name, item.type)}
                  <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: '220px',
                      }}
                      title={item.name}
                    >
                      {item.name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#8c94a8' }}>
                      {formatFileSize(item.size)}
                    </span>
                  </div>
                </div>

                {/* Item Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    onClick={(e) => copyPathOrName(item, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: copiedId === item.id ? '#4ade80' : '#8c94a8',
                      cursor: 'pointer',
                      padding: '4px',
                    }}
                    title="Copy path or filename"
                  >
                    {copiedId === item.id ? <Check size={12} /> : <Copy size={12} />}
                  </button>

                  {item.path && (
                    <button
                      onClick={(e) => openFile(item, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#8c94a8',
                        cursor: 'pointer',
                        padding: '4px',
                      }}
                      title="Open file"
                    >
                      <ExternalLink size={12} />
                    </button>
                  )}

                  <button
                    onClick={(e) => removeItem(item.id, e)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#f43f5e',
                      cursor: 'pointer',
                      padding: '4px',
                      opacity: 0.7,
                    }}
                    title="Remove from shelf"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};
