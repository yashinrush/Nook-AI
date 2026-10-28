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
  Lock,
  Power,
  RotateCcw,
  FileCode,
  FileSpreadsheet,
  FileArchive,
  FileImage,
  Send,
} from 'lucide-react';
import { invoke } from '@tauri-apps/api/core';
import { readText, writeText } from '@tauri-apps/plugin-clipboard-manager';

interface SpotlightProps {
  onBack: () => void;
}

interface SearchResult {
  id: string;
  type: 'calc' | 'convert' | 'app' | 'ai' | 'file' | 'clipboard' | 'command';
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  badge?: string;
  action: () => void | Promise<void>;
  secondaryAction?: () => void | Promise<void>;
}

interface SearchFileResult {
  name: string;
  path: string;
  extension: string;
}

interface AiMessage {
  role: 'user' | 'model';
  text: string;
}

// Built-in currency exchange rates
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

// Safe math evaluator for expressions like "45 * 89 + 12" or "15% of 300"
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

  // Arithmetic: allow digits, decimal, operators, parentheses, sqrt, pi
  if (!/^[\d\s+\-*/%^().sqrtabsPIEpie,]+$/.test(clean)) return null;
  if (!/\d/.test(clean)) return null;
  if (!/[+\-*/%^]/.test(clean) && !clean.startsWith('sqrt') && !clean.startsWith('abs')) return null;

  try {
    const sanitized = clean
      .replace(/\^/g, '**')
      .replace(/pi/g, 'Math.PI')
      .replace(/e/g, 'Math.E')
      .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
      .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)');

    // Avoid arbitrary code execution
    if (/[a-zA-Z]/.test(sanitized.replace(/Math\.(PI|E|sqrt|abs)/g, ''))) return null;

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
  const distMatch = clean.match(
    /^([\d.]+)\s*(km|kms|kilometer|kilometers|miles|mile|mi|meters|m|feet|ft|inches|inch|in|cm)\s*(?:to|in)\s*(km|kms|miles|mile|mi|meters|m|feet|ft|inches|inch|in|cm)$/
  );
  if (distMatch) {
    const amt = parseFloat(distMatch[1]);
    const from = distMatch[2];
    const to = distMatch[3];

    let meters = amt;
    if (['km', 'kms', 'kilometer', 'kilometers'].includes(from)) meters = amt * 1000;
    else if (['miles', 'mile', 'mi'].includes(from)) meters = amt * 1609.344;
    else if (['feet', 'ft'].includes(from)) meters = amt * 0.3048;
    else if (['inches', 'inch', 'in'].includes(from)) meters = amt * 0.0254;
    else if (['cm'].includes(from)) meters = amt * 0.01;

    let res = meters;
    let label = to;
    if (['miles', 'mile', 'mi'].includes(to)) {
      res = meters / 1609.344;
      label = 'miles';
    } else if (['km', 'kms', 'kilometer', 'kilometers'].includes(to)) {
      res = meters / 1000;
      label = 'km';
    } else if (['feet', 'ft'].includes(to)) {
      res = meters / 0.3048;
      label = 'feet';
    } else if (['inches', 'inch', 'in'].includes(to)) {
      res = meters / 0.0254;
      label = 'inches';
    } else if (['cm'].includes(to)) {
      res = meters / 0.01;
      label = 'cm';
    }

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
    if (['lbs', 'pounds', 'pound'].includes(to)) {
      res = grams / 453.592;
      label = 'lbs';
    } else if (['kg', 'kgs'].includes(to)) {
      res = grams / 1000;
      label = 'kg';
    }

    const formatted = parseFloat(res.toFixed(2));
    return {
      title: `${amt} ${from} = ${formatted} ${label}`,
      subtitle: 'Weight Conversion',
      valToCopy: `${formatted} ${label}`,
    };
  }

  // 5. Digital Storage: "10 gb to mb", "1 tb to gb", "500 mb in gb"
  const storageMatch = clean.match(/^([\d.]+)\s*(gb|mb|tb|kb|gigabytes|megabytes|terabytes|kilobytes)\s*(?:to|in)\s*(gb|mb|tb|kb|gigabytes|megabytes|terabytes|kilobytes)$/);
  if (storageMatch) {
    const amt = parseFloat(storageMatch[1]);
    const from = storageMatch[2].slice(0, 2).toLowerCase();
    const to = storageMatch[3].slice(0, 2).toLowerCase();
    const multipliers: Record<string, number> = { kb: 1, mb: 1024, gb: 1024 * 1024, tb: 1024 * 1024 * 1024 };
    if (multipliers[from] && multipliers[to]) {
      const bytes = amt * multipliers[from];
      const res = parseFloat((bytes / multipliers[to]).toFixed(4));
      return {
        title: `${amt} ${from.toUpperCase()} = ${res} ${to.toUpperCase()}`,
        subtitle: `Data Storage Conversion`,
        valToCopy: `${res} ${to.toUpperCase()}`,
      };
    }
  }

  // 6. Time: "24 hours to min", "3 days in hours", "3600 sec to min"
  const timeMatch = clean.match(/^([\d.]+)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)\s*(?:to|in)\s*(sec|secs|second|seconds|min|mins|minute|minutes|hr|hrs|hour|hours|day|days|week|weeks)$/);
  if (timeMatch) {
    const amt = parseFloat(timeMatch[1]);
    const from = timeMatch[2];
    const to = timeMatch[3];
    const toSeconds = (u: string) => {
      if (u.startsWith('sec')) return 1;
      if (u.startsWith('min')) return 60;
      if (u.startsWith('hr') || u.startsWith('hour')) return 3600;
      if (u.startsWith('day')) return 86400;
      if (u.startsWith('week')) return 604800;
      return 1;
    };
    const totalSec = amt * toSeconds(from);
    const converted = parseFloat((totalSec / toSeconds(to)).toFixed(3));
    return {
      title: `${amt} ${from} = ${converted} ${to}`,
      subtitle: `Time Conversion`,
      valToCopy: `${converted} ${to}`,
    };
  }

  return null;
}

// Icon helper for files
function getFileIcon(ext: string) {
  const e = ext.toLowerCase();
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(e)) {
    return <FileImage size={16} color="#38bdf8" />;
  }
  if (['js', 'ts', 'jsx', 'tsx', 'py', 'rs', 'json', 'html', 'css', 'cpp', 'c', 'java', 'go', 'toml', 'yaml', 'yml'].includes(e)) {
    return <FileCode size={16} color="#a78bfa" />;
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(e)) {
    return <FileArchive size={16} color="#fbbf24" />;
  }
  if (['xlsx', 'xls', 'csv'].includes(e)) {
    return <FileSpreadsheet size={16} color="#34d399" />;
  }
  if (['pdf'].includes(e)) {
    return <FileText size={16} color="#f87171" />;
  }
  return <FileText size={16} color="#94a3b8" />;
}

// Inline renderer for rich Markdown in AI messages
function FormattedAiText({ text }: { text: string }) {
  const lines = text.split('\n');
  const blocks: React.ReactNode[] = [];
  let currentCode: string[] = [];
  let inCode = false;
  let codeLang = '';

  lines.forEach((line, idx) => {
    if (line.trim().startsWith('```')) {
      if (inCode) {
        const codeText = currentCode.join('\n');
        blocks.push(
          <div
            key={`code-${idx}`}
            style={{
              position: 'relative',
              background: 'rgba(0, 0, 0, 0.45)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '8px',
              padding: '10px 12px',
              margin: '6px 0',
              fontFamily: 'Consolas, Monaco, monospace',
              fontSize: '11px',
              overflowX: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '6px',
                opacity: 0.6,
                fontSize: '9.5px',
              }}
            >
              <span>{codeLang || 'code'}</span>
              <button
                type="button"
                onClick={() => writeText(codeText)}
                style={{
                  background: 'rgba(255, 255, 255, 0.12)',
                  border: 'none',
                  borderRadius: '4px',
                  color: '#ffffff',
                  padding: '2px 6px',
                  cursor: 'pointer',
                  fontSize: '9px',
                }}
              >
                Copy Code
              </button>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{codeText}</pre>
          </div>
        );
        currentCode = [];
        inCode = false;
        codeLang = '';
      } else {
        inCode = true;
        codeLang = line.trim().slice(3).trim();
      }
      return;
    }

    if (inCode) {
      currentCode.push(line);
      return;
    }

    if (!line.trim()) {
      blocks.push(<div key={`empty-${idx}`} style={{ height: '6px' }} />);
      return;
    }

    const headerMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headerMatch) {
      const level = headerMatch[1].length;
      blocks.push(
        <div
          key={`h-${idx}`}
          style={{
            fontWeight: 700,
            fontSize: level === 1 ? '13px' : level === 2 ? '12px' : '11.5px',
            color: '#ffffff',
            marginTop: '8px',
            marginBottom: '4px',
          }}
        >
          {headerMatch[2]}
        </div>
      );
      return;
    }

    const bulletMatch = line.match(/^[\*\-]\s+(.*)$/);
    if (bulletMatch) {
      blocks.push(
        <div key={`b-${idx}`} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '2px 0' }}>
          <span style={{ color: '#a78bfa', marginTop: '1px' }}>•</span>
          <span style={{ flex: 1 }}>{renderInline(bulletMatch[1])}</span>
        </div>
      );
      return;
    }

    const numMatch = line.match(/^(\d+)\.\s+(.*)$/);
    if (numMatch) {
      blocks.push(
        <div key={`n-${idx}`} style={{ display: 'flex', gap: '6px', alignItems: 'flex-start', margin: '2px 0' }}>
          <span style={{ color: '#a78bfa', fontWeight: 600 }}>{numMatch[1]}.</span>
          <span style={{ flex: 1 }}>{renderInline(numMatch[2])}</span>
        </div>
      );
      return;
    }

    blocks.push(
      <p key={`p-${idx}`} style={{ margin: '2px 0' }}>
        {renderInline(line)}
      </p>
    );
  });

  return <div style={{ fontSize: '11.5px', lineHeight: '1.55', color: '#e2e8f0' }}>{blocks}</div>;
}

function renderInline(str: string): React.ReactNode {
  const parts = str.split(/(\*\*.*?\*\*|`.*?`)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} style={{ color: '#ffffff', fontWeight: 600 }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code
          key={i}
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            padding: '1px 5px',
            borderRadius: '4px',
            fontFamily: 'monospace',
            color: '#a78bfa',
            fontSize: '10.5px',
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

export const SpotlightBar: React.FC<SpotlightProps> = ({ onBack }) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [installedApps, setInstalledApps] = useState<any[]>([]);
  const [fileResults, setFileResults] = useState<SearchFileResult[]>([]);
  const [clipboardSnippet, setClipboardSnippet] = useState<string>('');
  const [clipboardHistory, setClipboardHistory] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // AI query & conversation state
  const [aiActive, setAiActive] = useState(false);
  const [aiPromptInput, setAiPromptInput] = useState('');
  const [aiMessages, setAiMessages] = useState<AiMessage[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const aiChatScrollRef = useRef<HTMLDivElement>(null);
  const resultsContainerRef = useRef<HTMLDivElement>(null);

  // Auto focus & load apps, clipboard, and recent history
  useEffect(() => {
    inputRef.current?.focus();

    // Clipboard preview
    readText()
      .then((text) => {
        if (text && text.trim().length > 0) {
          const trimmed = text.trim();
          setClipboardSnippet(trimmed);
          try {
            const rawHist = localStorage.getItem('nook-clipboard-history');
            const hist: string[] = rawHist ? JSON.parse(rawHist) : [];
            const filtered = [trimmed, ...hist.filter((item) => item !== trimmed)].slice(0, 8);
            setClipboardHistory(filtered);
            localStorage.setItem('nook-clipboard-history', JSON.stringify(filtered));
          } catch {}
        }
      })
      .catch(() => {});

    // Load installed apps from backend
    invoke<any[]>('get_installed_apps')
      .then((apps) => {
        if (Array.isArray(apps)) {
          setInstalledApps(apps);
        }
      })
      .catch(() => {});
  }, []);

  // Search user files with debounce
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setFileResults([]);
      return;
    }

    let active = true;
    const timeout = setTimeout(() => {
      invoke<SearchFileResult[]>('search_user_files', { query: q })
        .then((files) => {
          if (active && Array.isArray(files)) {
            setFileResults(files);
          }
        })
        .catch(() => {});
    }, 120);

    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [query]);

  // Scroll to bottom of chat when new AI messages arrive
  useEffect(() => {
    if (aiActive && aiChatScrollRef.current) {
      aiChatScrollRef.current.scrollTop = aiChatScrollRef.current.scrollHeight;
    }
  }, [aiMessages, aiLoading, aiActive]);

  const handleCopy = useCallback((text: string, id: string) => {
    writeText(text)
      .then(() => {
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 1500);
      })
      .catch(() => {});
  }, []);

  // Built-in standard quick apps
  const standardApps = useMemo(
    () => [
      { name: 'Google Chrome', cmd: 'chrome', icon: <Globe size={16} color="#4285F4" /> },
      { name: 'Discord', cmd: 'discord', icon: <Globe size={16} color="#5865F2" /> },
      { name: 'Spotify', cmd: 'spotify', icon: <Globe size={16} color="#1DB954" /> },
      { name: 'Visual Studio Code', cmd: 'code', icon: <Code2 size={16} color="#007ACC" /> },
      { name: 'Windows Terminal', cmd: 'wt', icon: <Terminal size={16} color="#4ade80" /> },
      { name: 'Notepad', cmd: 'notepad', icon: <FileText size={16} color="#94a3b8" /> },
      { name: 'Calculator', cmd: 'calc', icon: <Calculator size={16} color="#fb923c" /> },
      { name: 'File Explorer', cmd: 'explorer', icon: <Folder size={16} color="#facc15" /> },
      { name: 'Settings', cmd: 'nectar-settings', icon: <Settings size={16} color="#a78bfa" /> },
      { name: 'Task Manager', cmd: 'taskmgr', icon: <AppWindow size={16} color="#38bdf8" /> },
    ],
    []
  );

  // Send query to Gemini API or local Ollama
  const triggerAiQuery = useCallback(async (promptText: string) => {
    const p = promptText.trim();
    if (!p) return;

    setAiActive(true);
    setAiLoading(true);
    setAiMessages((prev) => [...prev, { role: 'user', text: p }]);
    setQuery('');

    const defaultKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    const apiKey = localStorage.getItem('nook-gemini-api-key') || defaultKey;
    const model = localStorage.getItem('nook-gemini-model') || 'gemini-3.5-flash';

    // 1. Try Gemini API
    if (apiKey) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 14000);
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: p }] }],
            }),
            signal: controller.signal,
          }
        );
        clearTimeout(timeout);

        if (res.ok) {
          const data = await res.json();
          const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            setAiMessages((prev) => [...prev, { role: 'model', text: text.trim() }]);
            setAiLoading(false);
            return;
          }
        }
      } catch (err) {
        console.warn('Gemini query error:', err);
      }
    }

    // 2. Try Local Ollama
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      const res = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'llama3:latest',
          prompt: p,
          stream: false,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json();
        if (data.response) {
          setAiMessages((prev) => [...prev, { role: 'model', text: data.response.trim() }]);
          setAiLoading(false);
          return;
        }
      }
    } catch {}

    // 3. Fallback intelligent offline assistant synthesizer
    setTimeout(() => {
      const lower = p.toLowerCase();
      let answer = '';
      if (lower.includes('hello') || lower.includes('hi')) {
        answer = 'Hello! I am Nook AI. You can ask me questions, calculate math, convert currencies, or launch desktop apps.';
      } else if (lower.includes('weather')) {
        answer = 'You can check real-time weather conditions on the left widget in your Notch status bar.';
      } else if (lower.includes('python') || lower.includes('code') || lower.includes('function')) {
        answer = 'Here is a quick Python snippet:\n\n```python\ndef greet(name: str) -> str:\n    return f"Hello, {name}!"\n\nprint(greet("Nook User"))\n```';
      } else if (lower.includes('time') || lower.includes('date')) {
        answer = `Current local time is ${new Date().toLocaleTimeString()} on ${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.`;
      } else {
        answer = `**AI Insight for "${p}"**:\nNook AI processes queries, conversions, and commands in real time. Configure your Gemini API key in Settings or run Ollama locally for continuous deep reasoning.`;
      }
      setAiMessages((prev) => [...prev, { role: 'model', text: answer }]);
      setAiLoading(false);
    }, 400);
  }, []);

  // Compute results dynamically
  const results: SearchResult[] = useMemo(() => {
    const list: SearchResult[] = [];
    const q = query.trim();

    if (!q) {
      // Empty query: Show clipboard snippet, recent clipboard history & quick launchers
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
        action: () => triggerAiQuery('Tell me something interesting about technology today'),
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

    const lowerQ = q.toLowerCase();

    // Check if query is explicitly directed to AI (starts with "ai ", "?", "gemini ", or common prompt phrasing)
    const isDirectAi =
      lowerQ.startsWith('ai ') ||
      lowerQ.startsWith('? ') ||
      lowerQ.startsWith('?') ||
      lowerQ.startsWith('gemini ') ||
      /^(what|how|why|who|when|where|explain|tell|write|create|solve|can you)\b/.test(lowerQ);

    const cleanPrompt = q.replace(/^(ai\s+|\?\s*|gemini\s+)/i, '').trim();

    if (isDirectAi && cleanPrompt) {
      list.push({
        id: 'ai-prompt-priority',
        type: 'ai',
        title: `Ask AI: "${cleanPrompt}"`,
        subtitle: 'Press Enter to generate real-time AI answer',
        icon: <Sparkles size={16} color="#a78bfa" />,
        badge: 'AI Answer',
        action: () => triggerAiQuery(cleanPrompt),
      });
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

    // 3. User Files Search (Desktop, Downloads, Documents, Recent, Shelf)
    fileResults.forEach((file) => {
      list.push({
        id: `file-${file.path}`,
        type: 'file',
        title: file.name,
        subtitle: file.path,
        icon: getFileIcon(file.extension),
        badge: file.extension.toUpperCase() || 'FILE',
        action: () => {
          invoke('open_file_path', { path: file.path }).catch(() => {});
          onBack();
        },
        secondaryAction: () => {
          invoke('show_in_folder', { path: file.path }).catch(() => {});
        },
      });
    });

    // 4. File Shelf Matches
    try {
      const shelfRaw = localStorage.getItem('nook-shelf-items');
      if (shelfRaw) {
        const shelfItems = JSON.parse(shelfRaw);
        if (Array.isArray(shelfItems)) {
          shelfItems
            .filter((item: any) => item?.name?.toLowerCase().includes(lowerQ))
            .slice(0, 4)
            .forEach((item: any) => {
              if (!list.some((existing) => existing.subtitle === item.path)) {
                list.push({
                  id: `shelf-${item.id}`,
                  type: 'file',
                  title: item.name,
                  subtitle: item.path || 'Saved on Nook File Shelf',
                  icon: <Folder size={16} color="#38bdf8" />,
                  badge: 'Shelf',
                  action: () => {
                    if (item.path) {
                      invoke('open_file_path', { path: item.path }).catch(() => {});
                    }
                    onBack();
                  },
                });
              }
            });
        }
      }
    } catch {}

    // 5. App Search (Standard Apps + Installed Windows Apps)
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
      .filter(
        (a) =>
          a.name &&
          a.name.toLowerCase().includes(lowerQ) &&
          !matchedStandard.some((m) => m.name.toLowerCase() === a.name.toLowerCase())
      )
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

    // 6. Quick Windows System Commands
    if ('lock'.startsWith(lowerQ) || lowerQ === 'lock pc') {
      list.push({
        id: 'sys-lock',
        type: 'command',
        title: 'Lock Windows PC',
        subtitle: 'Lock screen immediately (Win + L)',
        icon: <Lock size={16} color="#f87171" />,
        badge: 'System',
        action: () => {
          invoke('open_file_path', { path: 'rundll32.exe user32.dll,LockWorkStation' }).catch(() => {});
          onBack();
        },
      });
    }

    if ('restart'.startsWith(lowerQ) || lowerQ === 'reboot') {
      list.push({
        id: 'sys-restart',
        type: 'command',
        title: 'Restart Computer',
        subtitle: 'Restart Windows immediately',
        icon: <RotateCcw size={16} color="#fbbf24" />,
        badge: 'System',
        action: () => {
          invoke('open_file_path', { path: 'shutdown /r /t 0' }).catch(() => {});
          onBack();
        },
      });
    }

    if ('shutdown'.startsWith(lowerQ) || lowerQ === 'turn off') {
      list.push({
        id: 'sys-shutdown',
        type: 'command',
        title: 'Shut Down Computer',
        subtitle: 'Power down PC immediately',
        icon: <Power size={16} color="#ef4444" />,
        badge: 'System',
        action: () => {
          invoke('open_file_path', { path: 'shutdown /s /t 0' }).catch(() => {});
          onBack();
        },
      });
    }

    // 7. Clipboard History Matches
    clipboardHistory
      .filter((clip) => clip.toLowerCase().includes(lowerQ) && clip !== clipboardSnippet)
      .slice(0, 2)
      .forEach((clip, i) => {
        list.push({
          id: `clip-hist-${i}`,
          type: 'clipboard',
          title: clip.length > 50 ? clip.slice(0, 50) + '…' : clip,
          subtitle: 'From Clipboard History • Press Enter to copy',
          icon: <Clipboard size={16} color="#38bdf8" />,
          badge: 'Clipboard',
          action: () => handleCopy(clip, `clip-hist-${i}`),
        });
      });

    // 8. General Ask AI Prompt Option (if not already added as direct query)
    if (!isDirectAi) {
      list.push({
        id: 'ai-prompt-query',
        type: 'ai',
        title: `Ask AI: "${q}"`,
        subtitle: 'Press Enter to get instant AI response from Gemini',
        icon: <Sparkles size={16} color="#a78bfa" />,
        badge: 'AI Assistant',
        action: () => triggerAiQuery(q),
      });
    }

    return list;
  }, [
    query,
    clipboardSnippet,
    clipboardHistory,
    standardApps,
    installedApps,
    fileResults,
    handleCopy,
    triggerAiQuery,
    onBack,
  ]);

  // Reset selected index when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  // Keyboard navigation & controls
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

  const handleAiPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiPromptInput.trim() || aiLoading) return;
    const txt = aiPromptInput.trim();
    setAiPromptInput('');
    triggerAiQuery(txt);
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
          height: '42px',
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
          placeholder="Ask AI, launch app, search files, convert units (50 usd to inr), calculate..."
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
              if (aiActive) setAiActive(false);
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
            title="Clear search"
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

      {/* Main Content Area: AI Interactive Chat or Search Results */}
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
            /* AI Interactive Conversation View */
            <motion.div
              key="ai-view"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '12px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(167, 139, 250, 0.25)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                boxSizing: 'border-box',
              }}
            >
              {/* Header with status & copy */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Bot size={16} color="#a78bfa" />
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#a78bfa',
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    Nook AI • Gemini
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {aiMessages.length > 0 && (
                    <button
                      onClick={() => {
                        const allAnswers = aiMessages
                          .filter((m) => m.role === 'model')
                          .map((m) => m.text)
                          .join('\n\n');
                        handleCopy(allAnswers, 'ai-copy');
                      }}
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
                    onClick={() => {
                      setAiActive(false);
                      setQuery('');
                      inputRef.current?.focus();
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'rgba(255, 255, 255, 0.5)',
                      cursor: 'pointer',
                      padding: 2,
                    }}
                    title="Close AI View (Esc)"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Messages Log */}
              <div
                ref={aiChatScrollRef}
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  paddingRight: '4px',
                }}
              >
                {aiMessages.map((msg, index) => (
                  <div
                    key={index}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
                      gap: '3px',
                    }}
                  >
                    <div
                      style={{
                        maxWidth: '92%',
                        padding: msg.role === 'user' ? '6px 10px' : '8px 12px',
                        borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        background: msg.role === 'user' ? 'rgba(167, 139, 250, 0.22)' : 'rgba(255, 255, 255, 0.06)',
                        border:
                          msg.role === 'user'
                            ? '1px solid rgba(167, 139, 250, 0.4)'
                            : '1px solid rgba(255, 255, 255, 0.1)',
                      }}
                    >
                      {msg.role === 'user' ? (
                        <span style={{ fontSize: '12px', fontWeight: 600, color: '#ffffff' }}>{msg.text}</span>
                      ) : (
                        <FormattedAiText text={msg.text} />
                      )}
                    </div>
                  </div>
                ))}

                {aiLoading && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '6px 10px',
                      color: 'rgba(255, 255, 255, 0.7)',
                      fontSize: '11px',
                    }}
                  >
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
                    >
                      <Sparkles size={14} color="#a78bfa" />
                    </motion.div>
                    Thinking with Gemini…
                  </div>
                )}
              </div>

              {/* Bottom Follow-up Input Bar */}
              <form
                onSubmit={handleAiPromptSubmit}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.06)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  borderRadius: '8px',
                  padding: '3px 8px',
                  marginTop: 'auto',
                }}
              >
                <input
                  type="text"
                  value={aiPromptInput}
                  onChange={(e) => setAiPromptInput(e.target.value)}
                  placeholder="Ask a follow-up question..."
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    outline: 'none',
                    color: '#ffffff',
                    fontSize: '11.5px',
                  }}
                />
                <button
                  type="submit"
                  disabled={!aiPromptInput.trim() || aiLoading}
                  style={{
                    background: aiPromptInput.trim() ? '#a78bfa' : 'transparent',
                    border: 'none',
                    borderRadius: '5px',
                    color: aiPromptInput.trim() ? '#000000' : 'rgba(255, 255, 255, 0.3)',
                    padding: '3px 6px',
                    cursor: aiPromptInput.trim() ? 'pointer' : 'default',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <Send size={12} />
                </button>
              </form>
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
                        <span
                          style={{
                            fontSize: '10px',
                            color: '#4ade80',
                            fontWeight: 600,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
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

                      {item.secondaryAction && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            item.secondaryAction?.();
                          }}
                          title="Show in Folder"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'rgba(255, 255, 255, 0.4)',
                            padding: '2px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                          }}
                        >
                          <Folder size={12} />
                        </button>
                      )}

                      <CornerDownLeft
                        size={12}
                        color={isSelected ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.25)'}
                      />
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
        <span>
          💡 Press <strong style={{ color: '#ffffff' }}>Alt + Space</strong> anytime to toggle Spotlight
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>
            <strong style={{ color: '#ffffff' }}>↑↓</strong> Navigate
          </span>
          <span>
            <strong style={{ color: '#ffffff' }}>↵</strong> Select
          </span>
        </div>
      </div>
    </div>
  );
};
