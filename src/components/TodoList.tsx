import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Plus, Trash2, ChevronLeft, Edit3, X, Check } from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: number;
}

interface TodoListProps {
  onBack?: () => void;
  className?: string;
  timeString?: string;
}

const DEFAULT_TASKS: TodoItem[] = [
  { id: '1', text: 'Revise the report', completed: true, createdAt: Date.now() - 3600000 },
  { id: '2', text: 'Reply to Dina', completed: true, createdAt: Date.now() - 2400000 },
  { id: '3', text: 'Post weekly update', completed: true, createdAt: Date.now() - 1200000 },
  { id: '4', text: 'Review team pull requests', completed: true, createdAt: Date.now() - 600000 },
  { id: '5', text: 'Design new notch UI', completed: false, createdAt: Date.now() },
];

function setKeyboardFocus(focused: boolean) {
  if (typeof window !== 'undefined' && (window as any).__TAURI_INTERNALS__) {
    invoke('set_notch_keyboard_focus', { focused }).catch(() => {});
  }
}

function GreenCheckIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="7.5" fill="#22c55e" />
      <path d="M4.8 8.2L7 10.4L11.2 5.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function IncompleteCircleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="8" cy="8" r="6.8" stroke="rgba(255, 255, 255, 0.35)" strokeWidth="1.5" />
    </svg>
  );
}

export const TodoList: React.FC<TodoListProps> = ({
  onBack,
  className = '',
  timeString,
}) => {
  const [tasks, setTasks] = useState<TodoItem[]>(() => {
    try {
      const saved = localStorage.getItem('nectar-todos');
      return saved ? JSON.parse(saved) : DEFAULT_TASKS;
    } catch {
      return DEFAULT_TASKS;
    }
  });

  const [isAdding, setIsAdding] = useState(false);
  const [newText, setNewText] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isAdding) {
      setKeyboardFocus(true);
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => {
        clearTimeout(timer);
      };
    } else {
      setKeyboardFocus(false);
    }
  }, [isAdding]);

  useEffect(() => {
    return () => {
      setKeyboardFocus(false);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem('nectar-todos', JSON.stringify(tasks));
  }, [tasks]);

  const toggleTask = useCallback((id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t))
    );
  }, []);

  const addTask = useCallback((e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newText.trim()) return;
    const item: TodoItem = {
      id: `${Date.now()}`,
      text: newText.trim(),
      completed: false,
      createdAt: Date.now(),
    };
    setTasks((prev) => [item, ...prev]);
    setNewText('');
    setIsAdding(false);
    setKeyboardFocus(false);
  }, [newText]);

  const deleteTask = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTasks((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const completedCount = tasks.filter((t) => t.completed).length;
  const totalCount = tasks.length;
  const progressRatio = totalCount > 0 ? completedCount / totalCount : 0;

  // Format current date: e.g. Mon 26 Oct 2026
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const timeFormatted = timeString || now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });

  return (
    <div
      className={`nusa-todo-container ${className}`}
      onClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '10px 16px 8px',
        color: '#eceff7',
        userSelect: 'none',
        boxSizing: 'border-box',
      }}
    >
      <style>{`
        .todo-tasks-scroll::-webkit-scrollbar {
          width: 4px;
        }
        .todo-tasks-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
        .todo-tasks-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.22);
          border-radius: 4px;
        }
        .todo-tasks-scroll::-webkit-scrollbar-thumb:hover {
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
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          flexShrink: 0,
        }}
      >
        {/* Left: Back button + TodoList Title */}
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
          <div style={{ display: 'flex', alignItems: 'center', fontSize: '13px', fontWeight: 800, letterSpacing: '-0.01em' }}>
            <span style={{ color: '#ffffff' }}>Todo</span>
            <span style={{ color: '#22c55e' }}>List</span>
          </div>
        </div>

        {/* Center: Progress Ring + Date & Time */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '11px' }}>
          <svg width="14" height="14" viewBox="0 0 20 20" style={{ transform: 'rotate(-90deg)', flexShrink: 0 }}>
            <circle cx="10" cy="10" r="7.5" stroke="rgba(255,255,255,0.18)" strokeWidth="2.5" fill="none" />
            <circle
              cx="10"
              cy="10"
              r="7.5"
              stroke="#22c55e"
              strokeWidth="2.5"
              strokeDasharray={47.1}
              strokeDashoffset={47.1 * (1 - progressRatio)}
              strokeLinecap="round"
              fill="none"
              style={{ transition: 'stroke-dashoffset 0.35s ease' }}
            />
          </svg>
          <span style={{ color: 'rgba(255, 255, 255, 0.72)', fontWeight: 500 }}>{dateStr}</span>
          <span style={{ color: '#ffffff', fontWeight: 800 }}>{timeFormatted}</span>
        </div>

        {/* Right: Sound Bar Visualizer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', opacity: 0.85, width: '24px', justifyContent: 'flex-end' }}>
          <span style={{ width: '2px', height: '6px', background: '#ffffff', borderRadius: '1px' }} />
          <span style={{ width: '2px', height: '13px', background: '#ffffff', borderRadius: '1px' }} />
          <span style={{ width: '2px', height: '9px', background: '#ffffff', borderRadius: '1px' }} />
          <span style={{ width: '2px', height: '5px', background: '#ffffff', borderRadius: '1px' }} />
        </div>
      </div>

      {/* Main Split Body: Left Stats & Actions, Right Tall Tasks Stack */}
      <div
        style={{
          display: 'flex',
          gap: '14px',
          alignItems: 'stretch',
          justifyContent: 'space-between',
          width: '100%',
          flex: 1,
          padding: '8px 0',
          minHeight: 0,
        }}
      >
        {/* Left Column: Stats & Action Buttons */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-start',
            width: '168px',
            minWidth: '168px',
            flexShrink: 0,
            paddingBottom: '8px',
          }}
        >
          {/* Top: Score & Progress */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                <span style={{ fontSize: '32px', fontWeight: 850, lineHeight: 1, letterSpacing: '-0.02em', color: '#ffffff' }}>
                  {completedCount}
                </span>
                <span style={{ fontSize: '17px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.4)' }}>
                  /{totalCount}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.6)', marginTop: '2px', fontWeight: 500 }}>
                Tasks Completed Today
              </div>
            </div>

            {/* Progress bar */}
            <div style={{ marginTop: '4px' }}>
              <div
                style={{
                  width: '100%',
                  height: '5px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '999px',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${progressRatio * 100}%`,
                    height: '100%',
                    backgroundColor: '#22c55e',
                    borderRadius: '999px',
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
              <div style={{ fontSize: '10px', color: '#22c55e', marginTop: '3px', fontWeight: 600 }}>
                {Math.round(progressRatio * 100)}% done
              </div>
            </div>
          </div>

          {/* Action Buttons: side-by-side row, cleanly aligned well above the boundary */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '12px', width: '100%' }}>
            <motion.button
              onClick={() => {
                const next = !isAdding;
                setIsAdding(next);
                if (!next) setKeyboardFocus(false);
              }}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 8px',
                borderRadius: '999px',
                backgroundColor: isAdding ? '#22c55e' : 'rgba(255, 255, 255, 0.12)',
                border: isAdding ? '1px solid #22c55e' : '1px solid rgba(255, 255, 255, 0.12)',
                color: isAdding ? '#03040a' : '#ffffff',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Plus size={12} strokeWidth={2.8} /> {isAdding ? 'Adding...' : 'Add Task'}
            </motion.button>

            <motion.button
              onClick={() => setIsEditing(!isEditing)}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.95 }}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                padding: '6px 8px',
                borderRadius: '999px',
                backgroundColor: isEditing ? 'rgba(239, 68, 68, 0.22)' : 'rgba(255, 255, 255, 0.08)',
                border: isEditing ? '1px solid rgba(239, 68, 68, 0.45)' : '1px solid rgba(255, 255, 255, 0.1)',
                color: isEditing ? '#f87171' : 'rgba(255, 255, 255, 0.85)',
                fontSize: '11px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
            >
              <Edit3 size={11} strokeWidth={2} /> {isEditing ? 'Done' : 'Edit Task'}
            </motion.button>
          </div>

          {/* Status Badge */}
          <div
            style={{
              marginTop: '10px',
              padding: '5px 8px',
              borderRadius: '8px',
              backgroundColor: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              fontSize: '10.5px',
              color: 'rgba(255, 255, 255, 0.55)',
              textAlign: 'center',
              fontWeight: 500,
            }}
          >
            {totalCount === 0
              ? 'No tasks for today'
              : completedCount === totalCount
              ? '🎉 All tasks completed!'
              : `${totalCount - completedCount} task${totalCount - completedCount > 1 ? 's' : ''} remaining`}
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '1px', backgroundColor: 'rgba(255, 255, 255, 0.08)', flexShrink: 0 }} />

        {/* Right Column: Scrollable Task Stack */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {isAdding && (
            <form onSubmit={addTask} style={{ display: 'flex', gap: '5px', height: '28px', marginBottom: '8px', flexShrink: 0 }}>
              <input
                ref={inputRef}
                autoFocus
                type="text"
                placeholder="New task title..."
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                onFocus={() => setKeyboardFocus(true)}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addTask();
                  } else if (e.key === 'Escape') {
                    e.preventDefault();
                    setIsAdding(false);
                    setKeyboardFocus(false);
                  }
                }}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setKeyboardFocus(true);
                }}
                style={{
                  flex: 1,
                  padding: '4px 10px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.14)',
                  border: '1px solid #22c55e',
                  color: '#ffffff',
                  fontSize: '11.5px',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '10px',
                  backgroundColor: '#22c55e',
                  color: '#03040a',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Save"
              >
                <Check size={14} strokeWidth={2.8} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAdding(false);
                  setKeyboardFocus(false);
                }}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '10px',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                  color: '#ffffff',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
                title="Cancel"
              >
                <X size={13} />
              </button>
            </form>
          )}

          <div
            className="todo-tasks-scroll"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overflowY: 'auto',
              paddingRight: '4px',
              boxSizing: 'border-box',
            }}
          >
            {tasks.length === 0 ? (
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11.5px', margin: 'auto', textAlign: 'center' }}>
                No tasks for today.
              </div>
            ) : (
              tasks.map((task) => (
                <motion.div
                  key={task.id}
                  onClick={() => toggleTask(task.id)}
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    minHeight: '28px',
                    height: '28px',
                    padding: '0 10px',
                    borderRadius: '10px',
                    backgroundColor: task.completed
                      ? 'rgba(14, 52, 26, 0.95)'
                      : 'rgba(255, 255, 255, 0.05)',
                    border: task.completed
                      ? '1px solid rgba(34, 197, 94, 0.35)'
                      : '1px solid rgba(255, 255, 255, 0.08)',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', minWidth: 0, flex: 1 }}>
                    {task.completed ? <GreenCheckIcon size={14} /> : <IncompleteCircleIcon size={14} />}
                    <span
                      style={{
                        fontSize: '11.5px',
                        fontWeight: 550,
                        color: task.completed ? 'rgba(255, 255, 255, 0.75)' : '#ffffff',
                        textDecoration: task.completed ? 'line-through' : 'none',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {task.text}
                    </span>
                  </div>

                  {isEditing && (
                    <button
                      onClick={(e) => deleteTask(task.id, e)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        cursor: 'pointer',
                        padding: '2px',
                        display: 'flex',
                        alignItems: 'center',
                        flexShrink: 0,
                        marginLeft: '4px',
                      }}
                      title="Delete task"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </motion.div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Footer: Pagination Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '4px',
          paddingTop: '4px',
          flexShrink: 0,
        }}
      >
        <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
        <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
        <span style={{ width: '3.5px', height: '3.5px', borderRadius: '50%', background: 'rgba(255,255,255,0.25)' }} />
        <span style={{ width: '14px', height: '3.5px', borderRadius: '2px', background: '#ffffff' }} />
      </div>
    </div>
  );
};
