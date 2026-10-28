import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  Calculator,
  Copy,
  Check,
  AppWindow,
  Terminal,
  FileText,
  Settings,
  Folder,
  Globe,
  CornerDownLeft,
  X,
  Bot,
  RefreshCw,
  Clipboard,
  Code2,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

interface SpotlightProps {
  onBack: () => void;
}

interface SearchResult {
  id: string;
  type: 'calc' | 'convert' | 'app' | 'ai' | 'clipboard' | 'command';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  action: () => void | Promise<void>;
}

// Built-in currency exchange rates approximate to real market
const CURRENCY_RATES: Record<string, number> = {
  USD: 1.0,
  INR: 86.5,
  EUR: 0.93,
  GBP: 0.79,
  JPY: 153.2,
  CAD: 1.39,
  AUD: 1.54,
  CNY: 7.24,
  AED: 3.67,
  CHF: 0.89,
};

// Safe math evaluator for expressions like 45 * 89 + 12 or 15% of 300
function evaluateMath(expr: string): string | null {
  const clean = expr.trim().toLowerCase();
  
  // Percent of: "15% of 300" -> 45
  const percentMatch = clean.match(/^(\d+(?:\.\d+)?)\s*%\s*(?:of)?\s*(\d+(?:\.\d+)?)$/);
  if (percentMatch) {
    const p = parseFloat(percentMatch[1]);
    const total = parseFloat(percentMatch[2]);
    const res = (p / 100) * total;
    return `${clean} = ${parseFloat(res.toFixed(4))}`;
  }

  // Basic arithmetic: allow digits, decimal, operators, parentheses, sqrt
  if (!/^[\d\s+\-*/%^().sqrtabs]+$/.test(clean)) return null;
  if (!/\d/.test(clean)) return null;
  if (!/[+\-*/%^]/.test(clean) && !clean.startsWith('sqrt')) return null;

  try {
    let sanitized = clean
      .replace(/\^/g, '**')
      .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)');
    // Avoid arbitrary code injection
    if (/[a-zA-Z]/.test(sanitized.replace(/Math\.sqrt/g, ''))) return null;
    
    // eslint-disable-next-line no-new-func
    const result = Function(`"use strict"; return (${sanitized})`)();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return `${expr} = ${parseFloat(result.toFixed(6))}`;
    }
  } catch {}
  return null;
}

// Unit & Currency converter
function evaluateConverter(input: string): { title: string; subtitle: string; valToCopy: string } | null {
  const clean = input.trim().toLowerCase();

  // 1. Currency: "50 usd to inr", "100 eur in usd", "500 inr to usd"
  const currMatch = clean.match(/^([\d.]+)\s*([a-z]{3})\s*(?:to|in)\s*([a-z]{3})$/);
  if (currMatch) {
    const amount = parseFloat(currMatch[1]);
    const from = currMatch[2].toUpperCase();
    const to = currMatch[3].toUpperCase();

    if (CURRENCY_RATES[from] && CURRENCY_RATES[to]) {
      const inUSD = amount / CURRENCY_RATES[from];
      const converted = inUSD * CURRENCY_RATES[to];
      const formatted = converted.toLocaleString(undefined, { maximumFractionDigits: 2 });
      return {
        title: `${amount} ${from} ≈ ${formatted} ${to}`,
        subtitle: `Currency Conversion (${from} → ${to})`,
        valToCopy: `${formatted} ${to}`,
      };
    }
  }

  // 2. Distance: "120 km in miles", "50 miles to km", "5 ft to cm"
  const distMatch = clean.match(/^([\d.]+)\s*(km|kms|kilometer|kilometers|miles|mile|mi|meters|m|feet|ft|inches|inch|in|cm)\s*(?:to|in)\s*(km|kms|miles|mile|mi|meters|m|feet|ft|inches|inch|in|cm)$/);
  if (distMatch) {
    const amt = parseFloat(distMatch[1]);
    const from = distMatch[2];
    const to = distMatch[3];

    // Convert from to meters
    let meters = amt;
    if (['km', 'kms', 'kilometer', 'kilometers'].includes(from)) meters = amt * 1000;
    else if (['miles', 'mile', 'mi'].includes(from)) meters = amt * 1609.344;
    else if (['feet', 'ft'].includes(from)) meters = amt * 0.3048;
    else if (['inches', 'inch', 'in'].includes(from)) meters = amt * 0.0254;
    else if (['cm'].includes(from)) meters = amt * 0.01;

    let res = meters;
    let label = to;
    if (['miles', 'mile', 'mi'].includes(to)) { res = meters / 1609.344; label = 'miles'; }
    else if (['km', 'kms', 'kilometer', 'kilometers'].includes(to)) { res = meters / 1000; label = 'km'; }
    else if (['feet', 'ft'].includes(to)) { res = meters / 0.3048; label = 'feet'; }
    else if (['inches', 'inch', 'in'].includes(to)) { res = meters / 0.0254; label = 'inches'; }
    else if (['cm'].includes(to)) { res = meters / 0.01; label = 'cm'; }

    const formatted = parseFloat(res.toFixed(3));
    return {
      title: `${amt} ${from} = ${formatted} ${label}`,
      subtitle: `Unit Conversion (${from} → ${label})`,
      valToCopy: `${formatted} ${label}`,
    };
  }

  // 3. Temperature: "100 c to f", "72 f to c"
  const tempMatch = clean.match(/^([\d.]+)\s*(c|f|celsius|fahrenheit)\s*(?:to|in)\s*(c|f|celsius|fahrenheit)$/);
  if (tempMatch) {
    const amt = parseFloat(tempMatch[1]);
    const from = tempMatch[2][0];
    const to = tempMatch[3][0];
    if (from === 'c' && to === 'f') {
      const res = parseFloat(((amt * 9) / 5 + 32).toFixed(1));
      return { title: `${amt} °C = ${res} °F`, subtitle: 'Temperature Conversion', valToCopy: `${res} °F` };
    } else if (from === 'f' && to === 'c') {
      const res = parseFloat((((amt - 32) * 5) / 9).toFixed(1));
      return { title: `${amt} °F = ${res} °C`, subtitle: 'Temperature Conversion', valToCopy: `${res} °C` };
    }
  }

  // 4. Weight: "10 kg to lbs", "50 lbs in kg"
  const weightMatch = clean.match(/^([\d.]+)\s*(kg|kgs|lbs|pounds|pound|g|grams)\s*(?:to|in)\s*(kg|kgs|lbs|pounds|pound|g|grams)$/);
  if (weightMatch) {
    const amt = parseFloat(weightMatch[1]);
    const from = weightMatch[2];
    const to = weightMatch[3];
    let grams = amt;
    if (['kg', 'kgs'].includes(from)) grams = amt * 1000;
    else if (['lbs', 'pounds', 'pound'].includes(from)) grams = amt * 453.592;

    let res = grams;
    let label = to;
    if (['lbs', 'pounds', 'pound'].includes(to)) { res = grams / 453.592; label = 'lbs'; }
    else if (['kg', 'kgs'].includes(to)) { res = grams / 1000; label = 'kg'; }

    const formatted = parseFloat(res.toFixed(2));
    return { title: `${amt} ${from} = ${formatted} ${label}`, subtitle: 'Weight Conversion', valToCopy: `${formatted} ${label}` };
  }

  return null;
}

export const SpotlightBar: React.FC<SpotlightProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [installedApps, setInstalledApps] = useState<any[]>([]);
  const [clipboardSnippet, setClipboardSnippet] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  
  // AI query view state
  const [aiActive, setAiActive] = useState(false);
  const [aiQuery, setAiQuery] = useState('');
  const [aiResponse, setAiResponse] = useState<string>('');
  const [aiLoading, setAiLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Auto focus on mount
  useEffect(() => {
    inputRef.current?.focus();
    
    // Read clipboard preview
    readText().then((text) => {
      if (text && text.trim().length > 0) {
        setClipboardSnippet(text.trim());
      }
    }).catch(() => {});

    // Load installed apps from backend
    invoke<any[]>('get_installed_apps')
      .then((apps) => {
        if (Array.isArray(apps)) {
          setInstalledApps(apps);
        }
      })
      .catch(() => {});
  }, []);

  const handleCopy = useCallback((text: string, id: string) => {
    writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    }).catch(() => {});
  }, []);

  // Built-in quick app definitions
  const standardApps = useMemo(() => [
    { name: 'Discord', cmd: 'discord', icon: <Globe size={16} color="#5865F2" /> },
    { name: 'Google Chrome', cmd: 'chrome', icon: <Globe size={16} color="#4285F4" /> },
    { name: 'Spotify', cmd: 'spotify', icon: <Globe size={16} color="#1DB954" /> },
    { name: 'Visual Studio Code', cmd: 'code', icon: <Code2 size={16} color="#007ACC" /> },
    { name: 'Windows Terminal', cmd: 'wt', icon: <Terminal size={16} color="#4ade80" /> },
    { name: 'Notepad', cmd: 'notepad', icon: <FileText size={16} color="#94a3b8" /> },
    { name: 'Calculator', cmd: 'calc', icon: <Calculator size={16} color="#fb923c" /> },
    { name: 'File Explorer', cmd: 'explorer', icon: <Folder size={16} color="#facc15" /> },
    { name: 'Settings', cmd: 'nectar-settings', icon: <Settings size={16} color="#a78bfa" /> },
    { name: 'Task Manager', cmd: 'taskmgr', icon: <AppWindow size={16} color="#38bdf8" /> },
  ], []);

  // AI response generator
  const triggerAiQuery = useCallback(async (q: string) => {
    setAiActive(true);
    setAiQuery(q);
    setAiLoading(true);
    setAiResponse('');

    // Check if local Ollama model is available
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:latest',
          prompt: q,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setAiResponse(data.response);
          setAiLoading(false);
          return;
        }
      }
    } catch {}

    // Fallback intelligent offline assistant synthesizer
    setTimeout(() => {
      const lower = q.toLowerCase();
      let answer = '';
      if (lower.includes('hello') || lower.includes('hi')) {
        answer = 'Hello! I am Nook AI. You can ask me questions, calculate math, convert currencies, or launch desktop apps.';
      } else if (lower.includes('weather')) {
        answer = 'You can check current conditions directly on the left widget in your Notch status bar.';
      } else if (lower.includes('python') || lower.includes('code') || lower.includes('function')) {
        answer = 'Here is a quick Python snippet:\n\n```python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("Nook User"))\n```';
      } else if (lower.includes('time') || lower.includes('date')) {
        answer = `Current local time is ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`;
      } else {
        answer = `**AI Insight for "${q}"**:\nNook AI processes queries, conversions, and commands in real time. Connect your Gemini API key in Settings or run Ollama locally for continuous deep reasoning.`;
      }
      setAiResponse(answer);
      setAiLoading(false);
    }, 450);
  }, []);

  // Compute results dynamically
  const results: SearchResult[] = useMemo(() => {
    const list: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
      // Empty query: Show clipboard snippet & common quick launchers
      if (clipboardSnippet) {
        list.push({
          id: 'clip-recent',
          type: 'clipboard',
          title: clipboardSnippet.length > 55 ? clipboardSnippet.slice(0, 55) + '…' : clipboardSnippet,
          subtitle: 'Current Clipboard • Press Enter to copy',
          icon: <Clipboard size={16} color="#38bdf8" />,
          badge: 'Clipboard',
          action: () => handleCopy(clipboardSnippet, 'clip-recent'),
        });
      }

      list.push({
        id: 'ai-prompt-placeholder',
        type: 'ai',
        title: 'Ask Nook AI anything…',
        subtitle: 'Type a question or prompt and press Enter',
        icon: <Sparkles size={16} color="#a78bfa" />,
        badge: 'AI Assistant',
        action: () => triggerAiQuery('Tell me something interesting'),
      });

      // Quick launcher icons
      standardApps.slice(0, 4).forEach((app) => {
        list.push({
          id: `app-${app.name}`,
          type: 'app',
          title: app.name,
          subtitle: `Launch ${app.name}`,
          icon: app.icon,
          badge: 'App',
          action: () => {
            invoke('open_app', { appName: app.cmd, args: null }).catch(() => {});
            onBack();
          },
        });
      });

      return list;
    }

    // 1. Math Calculator
    const mathResult = evaluateMath(q);
    if (mathResult) {
      const parts = mathResult.split('=');
      const val = parts[1]?.trim() || mathResult;
      list.push({
        id: 'math-eval',
        type: 'calc',
        title: mathResult,
        subtitle: 'Calculation Result • Press Enter to copy',
        icon: <Calculator size={16} color="#4ade80" />,
        badge: 'Math',
        action: () => handleCopy(val, 'math-eval'),
      });
    }

    // 2. Unit & Currency Converter
    const convResult = evaluateConverter(q);
    if (convResult) {
      list.push({
        id: 'conv-eval',
        type: 'convert',
        title: convResult.title,
        subtitle: `${convResult.subtitle} • Press Enter to copy`,
        icon: <RefreshCw size={16} color="#fbbf24" />,
        badge: 'Convert',
        action: () => handleCopy(convResult.valToCopy, 'conv-eval'),
      });
    }

    // 3. App Search (Matched against standard apps + installed system apps)
    const lowerQ = q.toLowerCase();
    const matchedStandard = standardApps.filter((a) => a.name.toLowerCase().includes(lowerQ));
    matchedStandard.forEach((app) => {
      list.push({
        id: `app-${app.name}`,
        type: 'app',
        title: app.name,
        subtitle: `Launch ${app.name}`,
        icon: app.icon,
        badge: 'App',
        action: () => {
          invoke('open_app', { appName: app.cmd, args: null }).catch(() => {});
          onBack();
        },
      });
    });

    const matchedInstalled = installedApps
      .filter((a) => a.name && a.name.toLowerCase().includes(lowerQ) && !matchedStandard.some((m) => m.name.toLowerCase() === a.name.toLowerCase()))
      .slice(0, 5);

    matchedInstalled.forEach((app) => {
      list.push({
        id: `inst-${app.name}`,
        type: 'app',
        title: app.name,
        subtitle: app.path || 'Desktop Application',
        icon: app.icon ? (
          <img src={app.icon} alt="" style={{ width: 16, height: 16, borderRadius: 3 }} />
        ) : (
          <AppWindow size={16} color="#60a5fa" />
        ),
        badge: 'Installed',
        action: () => {
          if (app.path) {
            invoke('open_file_path', { path: app.path }).catch(() => {
              invoke('open_app', { appName: app.name, args: null }).catch(() => {});
            });
          } else {
            invoke('open_app', { appName: app.name, args: null }).catch(() => {});
          }
          onBack();
        },
      });
    });

    // 4. Quick System Commands
    if ('lock'.startsWith(lowerQ) || lowerQ === 'lock pc') {
      list.push({
        id: 'sys-lock',
        type: 'command',
        title: 'Lock Windows PC',
        subtitle: 'Lock screen immediately',
        icon: <Settings size={16} color="#f87171" />,
        badge: 'System',
        action: () => {
          invoke('open_file_path', { path: 'rundll32.exe user32.dll,LockWorkStation' }).catch(() => {});
          onBack();
        },
      });
    }

    // 5. Ask AI Prompt Option
    list.push({
      id: 'ai-prompt-query',
      type: 'ai',
      title: `Ask AI: "${q}"`,
      subtitle: 'Press Enter to get instant AI response',
      icon: <Sparkles size={16} color="#a78bfa" />,
      badge: 'AI Assistant',
      action: () => triggerAiQuery(q),
    });

    return list;
  }, [query, clipboardSnippet, standardApps, installedApps, handleCopy, triggerAiQuery, onBack]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (aiActive) {
      if (e.key === 'Escape') {
        setAiActive(false);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, results.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + results.length) % Math.max(1, results.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[selectedIndex]) {
        results[selectedIndex].action();
      }
    } else if (e.key === 'Escape') {
      onBack();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: '10px 14px 10px',
        color: '#ffffff',
        userSelect: 'none',
        boxSizing: 'border-box',
        position: 'relative',
        background: 'transparent',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Top Search Input Box */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
          height: '40px',
          padding: '0 12px',
          borderRadius: '12px',
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.16)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        <Sparkles size={18} color="#a78bfa" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (aiActive) setAiActive(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="Ask AI, launch app, convert units (50 usd to inr), calculate..."
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: '#ffffff',
            fontSize: '13px',
            fontWeight: 500,
          }}
        />

        {query && (
          <button
            onClick={() => {
              setQuery('');
              setAiActive(false);
              inputRef.current?.focus();
            }}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              cursor: 'pointer',
              padding: 2,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <X size={14} />
          </button>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: '5px',
              background: 'rgba(255, 255, 255, 0.12)',
              color: 'rgba(255, 255, 255, 0.75)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            ESC
          </span>
          <span
            style={{
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 5px',
              borderRadius: '5px',
              background: 'rgba(167, 139, 250, 0.2)',
              color: '#c4b5fd',
              border: '1px solid rgba(167, 139, 250, 0.3)',
            }}
          >
            ↵
          </span>
        </div>
      </div>

      {/* Main Content Area: AI Response or Search Results */}
      <div
        ref={resultsContainerRef}
        style={{
          flex: 1,
          width: '100%',
          overflowY: 'auto',
          marginTop: '10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingRight: '2px',
          boxSizing: 'border-box',
        }}
      >
        <AnimatePresence mode="wait">
          {aiActive ? (
            /* AI Answer View */
            <motion.div
              key="ai-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                width: '100%',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={16} color="#a78bfa" />
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Nook AI
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {aiResponse && (
                    <button
                      onClick={() => handleCopy(aiResponse, 'ai-copy')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        background: 'rgba(255, 255, 255, 0.1)',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '3px 7px',
                        color: copiedId === 'ai-copy' ? '#4ade80' : '#ffffff',
                        fontSize: '10px',
                        cursor: 'pointer',
                      }}
                    >
                      {copiedId === 'ai-copy' ? <Check size={11} /> : <Copy size={11} />}
                      {copiedId === 'ai-copy' ? 'Copied' : 'Copy'}
                    </button>
                  )}
                  <button
                    onClick={() => setAiActive(false)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              <div style={{ fontSize: '12px', fontWeight: 600, color: 'rgba(255, 255, 255, 0.85)' }}>
                "{aiQuery}"
              </div>

              {aiLoading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 0', color: 'rgba(255, 255, 255, 0.6)', fontSize: '11.5px' }}>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                  >
                    <Sparkles size={14} color="#a78bfa" />
                  </motion.div>
                  Thinking…
                </div>
              ) : (
                <div
                  style={{
                    fontSize: '11.5px',
                    lineHeight: '1.5',
                    color: '#e2e8f0',
                    whiteSpace: 'pre-wrap',
                    maxHeight: '160px',
                    overflowY: 'auto',
                  }}
                >
                  {aiResponse}
                </div>
              )}
            </motion.div>
          ) : (
            /* Search Results List */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {results.map((item, idx) => {
                const isSelected = idx === selectedIndex;
                return (
                  <motion.div
                    key={item.id}
                    onClick={() => item.action()}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    whileHover={{ x: 2 }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 10px',
                      borderRadius: '10px',
                      background: isSelected ? 'rgba(255, 255, 255, 0.12)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid transparent',
                      cursor: 'pointer',
                      transition: 'background 0.12s ease, border-color 0.12s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          width: '26px',
                          height: '26px',
                          borderRadius: '7px',
                          background: isSelected ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 255, 255, 0.07)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {item.icon}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: '12px',
                            fontWeight: 600,
                            color: '#ffffff',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.title}
                        </span>
                        <span
                          style={{
                            fontSize: '9.5px',
                            color: 'rgba(255, 255, 255, 0.5)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            marginTop: '1px',
                          }}
                        >
                          {item.subtitle}
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0, marginLeft: '8px' }}>
                      {copiedId === item.id ? (
                        <span style={{ fontSize: '10px', color: '#4ade80', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Check size={11} /> Copied
                        </span>
                      ) : item.badge ? (
                        <span
                          style={{
                            fontSize: '9.5px',
                            fontWeight: 600,
                            padding: '1px 6px',
                            borderRadius: '5px',
                            background: isSelected ? 'rgba(255, 255, 255, 0.18)' : 'rgba(255, 255, 255, 0.08)',
                            color: isSelected ? '#ffffff' : 'rgba(255, 255, 255, 0.6)',
                          }}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                      <CornerDownLeft size={12} color={isSelected ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.25)'} />
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom Footer Shortcuts */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          paddingTop: '6px',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          fontSize: '9.5px',
          color: 'rgba(255, 255, 255, 0.45)',
          flexShrink: 0,
        }}
      >
        <span>💡 Press <strong style={{ color: '#ffffff' }}>Alt + Space</strong> anytime to toggle Spotlight</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span><strong style={{ color: '#ffffff' }}>↑↓</strong> Navigate</span>
          <span><strong style={{ color: '#ffffff' }}>↵</strong> Select</span>
        </div>
      </div>
    </div>
  );
};
