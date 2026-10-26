import React, { useState, useEffect, useLayoutEffect, useCallback, useRef, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Mic2, Music, RefreshCw } from 'lucide-react';

export interface LyricLine {
  timeMs: number;
  text: string;
}

interface SyncedLyricsProps {
  title: string;
  artist: string;
  durationMs?: number;
  positionMs?: number;
  isPlaying?: boolean;
  compact?: boolean;
  align?: 'center' | 'left';
  onSeek?: (positionMs: number) => void;
  onClose?: () => void;
  className?: string;
}

// Sample fallback lyrics matching the mockup from Image 1 with continuous timestamps
export const PAPER_SKY_LYRICS: LyricLine[] = [
  { timeMs: 0, text: "Drifting on the morning breeze" },
  { timeMs: 8000, text: "Sunlight falling through the trees" },
  { timeMs: 16000, text: "Waking up to summer days" },
  { timeMs: 25000, text: "Lost inside an ocean haze" },
  { timeMs: 34000, text: "Take my hand and fly away" },
  { timeMs: 44000, text: "Nothing left for us to say" },
  { timeMs: 54000, text: "Floating up into the blue" },
  { timeMs: 65000, text: "Every dream belongs to you" },
  { timeMs: 76000, text: "Waves are crashing down below" },
  { timeMs: 88000, text: "Where the gentle breezes blow" },
  { timeMs: 100000, text: "Golden shores and quiet night" },
  { timeMs: 112000, text: "Everything will be alright" },
  { timeMs: 124000, text: "Hold on tight don't let it go" },
  { timeMs: 136000, text: "Higher than the stars can glow" },
  { timeMs: 148000, text: "Paper wings across the sea" },
  { timeMs: 156000, text: "That is where we want to be" },
  { timeMs: 164000, text: "to find you by the sea" },
  { timeMs: 171000, text: "every wing a little song" },
  { timeMs: 177000, text: "that carries us along" },
  { timeMs: 184000, text: "clouds drift over the shore" },
  { timeMs: 191000, text: "listening to the waves once more" },
  { timeMs: 198000, text: "paper sky unfolding bright" },
  { timeMs: 206000, text: "guiding us into the light" },
  { timeMs: 215000, text: "Every shadow turns to gold" },
  { timeMs: 224000, text: "Stories that were never told" },
  { timeMs: 234000, text: "Paper sky will lead us home" },
  { timeMs: 245000, text: "Never walk this road alone" },
];

// Robust LRC parser handling single/multi-tags and variable decimals
export function parseLrc(lrcText: string): LyricLine[] {
  const lines = lrcText.split('\n');
  const result: LyricLine[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('[ti:') || trimmed.startsWith('[ar:') || trimmed.startsWith('[al:') || trimmed.startsWith('[by:')) {
      continue;
    }

    // Extract text after all timestamp tags
    const text = trimmed.replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '').trim();
    if (!text) continue;

    // Match all timestamp tags in this line
    const tagRegex = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fracStr = match[3] || '0';
      const frac = fracStr.length === 1 ? parseInt(fracStr, 10) * 100 : fracStr.length === 2 ? parseInt(fracStr, 10) * 10 : parseInt(fracStr, 10);
      const timeMs = minutes * 60000 + seconds * 1000 + frac;
      result.push({ timeMs, text });
    }
  }

  return result.sort((a, b) => a.timeMs - b.timeMs);
}

export const SyncedLyrics: React.FC<SyncedLyricsProps> = ({
  title,
  artist,
  durationMs = 0,
  positionMs = 0,
  isPlaying: _isPlaying = false,
  compact = false,
  align = 'center',
  onSeek,
  onClose,
  className = '',
}) => {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [plainLyrics, setPlainLyrics] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [userScrollOffset, setUserScrollOffset] = useState(0);
  const [isUserScrolling, setIsUserScrolling] = useState(false);
  const isUserScrollingRef = useRef(false);
  const userScrollTimeoutRef = useRef<number | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const lineRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Fetch lyrics when track changes
  useEffect(() => {
    const cleanTitle = (title || '').trim();
    const cleanArtist = (artist || '').trim();

    // Check if demo/sample track "Paper Sky"
    if (!cleanTitle || cleanTitle.toLowerCase().includes('paper sky') || cleanTitle.toLowerCase() === 'unknown title') {
      setLyrics(PAPER_SKY_LYRICS);
      setPlainLyrics(null);
      setError(null);
      setLoading(false);
      return;
    }

    let isCancelled = false;
    setLoading(true);
    setError(null);

    const strippedTitle = cleanTitle
      .replace(/\s*\(feat\..*?\)/gi, '')
      .replace(/\s*\[feat\..*?\]/gi, '')
      .replace(/\s*-.*remaster.*$/gi, '')
      .trim();

    const fetchLyrics = async () => {
      try {
        const durationSec = durationMs > 0 ? Math.round(durationMs / 1000) : 0;
        let url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(strippedTitle)}&artist_name=${encodeURIComponent(cleanArtist)}`;
        if (durationSec > 0) {
          url += `&duration=${durationSec}`;
        }

        let res = await fetch(url, { headers: { 'User-Agent': 'Nook-Windows-Notch/1.4' } });

        if (!res.ok) {
          // Fallback to search endpoint
          const searchUrl = `https://lrclib.net/api/search?track_name=${encodeURIComponent(strippedTitle)}${cleanArtist ? `&artist_name=${encodeURIComponent(cleanArtist)}` : ''}`;
          const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Nook-Windows-Notch/1.4' } });
          if (searchRes.ok) {
            const list = await searchRes.json();
            if (Array.isArray(list) && list.length > 0) {
              const item = list.find((i: any) => i.syncedLyrics) || list[0];
              if (!isCancelled) {
                if (item.syncedLyrics) {
                  setLyrics(parseLrc(item.syncedLyrics));
                } else if (item.plainLyrics) {
                  setPlainLyrics(item.plainLyrics);
                } else {
                  setLyrics(PAPER_SKY_LYRICS);
                }
              }
              return;
            }
          }
          // If search fails or not found, fallback gracefully to sample lyrics
          if (!isCancelled) {
            setLyrics(PAPER_SKY_LYRICS);
          }
          return;
        }

        const data = await res.json();
        if (isCancelled) return;

        if (data.syncedLyrics) {
          setLyrics(parseLrc(data.syncedLyrics));
        } else if (data.plainLyrics) {
          setPlainLyrics(data.plainLyrics);
        } else {
          setLyrics(PAPER_SKY_LYRICS);
        }
      } catch {
        if (!isCancelled) {
          // Fallback gracefully so lyrics UI is never blank
          setLyrics(PAPER_SKY_LYRICS);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    fetchLyrics();

    return () => {
      isCancelled = true;
    };
  }, [title, artist, durationMs]);

  // Determine active lyric index based on current playback position
  const activeIndex = useMemo(() => {
    if (!lyrics.length) return -1;
    let idx = -1;
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].timeMs <= positionMs + 180) {
        idx = i;
      } else {
        break;
      }
    }
    // If position is before first lyric, default to first lyric so lines are visible
    if (idx === -1 && lyrics.length > 0) {
      return 0;
    }
    return idx;
  }, [lyrics, positionMs]);

  // Robust, invariant Spotify-style positioning calculation
  const updatePosition = useCallback(() => {
    if (isUserScrollingRef.current) return;
    if (activeIndex < 0 || !containerRef.current) return;

    const lineEl = lineRefs.current[activeIndex];
    const container = containerRef.current;
    if (!lineEl || !container) return;

    const containerHeight = container.clientHeight || (align === 'left' ? 114 : 140);
    // Vertical center anchor
    const containerCenter = containerHeight / 2;
    // Exact center coordinate of active line relative to list top (invariant to scroll)
    const lineCenter = lineEl.offsetTop + (lineEl.clientHeight / 2);

    // targetY brings lineCenter to exact containerCenter with zero drift
    const targetY = containerCenter - lineCenter;
    setTranslateY(targetY);
  }, [activeIndex, align]);

  // Re-position list whenever activeIndex changes
  useLayoutEffect(() => {
    isUserScrollingRef.current = false;
    setIsUserScrolling(false);
    setUserScrollOffset(0);

    updatePosition();
  }, [activeIndex, updatePosition]);

  // Re-calculate position when container resizes (e.g. notch expansion animation)
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver(() => {
      updatePosition();
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [updatePosition]);

  // Handle user manual scroll with mouse wheel (Spotify-style temporary peek)
  const handleWheel = (e: React.WheelEvent) => {
    e.stopPropagation();
    isUserScrollingRef.current = true;
    setIsUserScrolling(true);

    setUserScrollOffset((prev) => {
      const next = prev - e.deltaY * 0.7;
      const maxScroll = Math.max(150, lyrics.length * 36);
      return Math.max(-maxScroll, Math.min(maxScroll, next));
    });

    if (userScrollTimeoutRef.current) clearTimeout(userScrollTimeoutRef.current);
    userScrollTimeoutRef.current = window.setTimeout(() => {
      isUserScrollingRef.current = false;
      setIsUserScrolling(false);
      setUserScrollOffset(0);
      updatePosition();
    }, 2000);
  };

  // 1-line Compact Ticker mode (for inside unhovered notch or small bar)
  if (compact) {
    const currentLine = activeIndex >= 0 && lyrics[activeIndex] ? lyrics[activeIndex].text : null;
    if (!currentLine) return null;

    return (
      <div
        className={`compact-lyrics-ticker ${className}`}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          maxWidth: '220px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontSize: '11px',
          color: '#19b8ff',
          fontWeight: 600,
          userSelect: 'none',
        }}
      >
        <Mic2 size={11} strokeWidth={2.5} style={{ flexShrink: 0, opacity: 0.8 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{currentLine}</span>
      </div>
    );
  }

  const isLeft = align === 'left';
  const effectiveTranslateY = translateY + userScrollOffset;

  // Full Karaoke View
  return (
    <div
      ref={containerRef}
      className={`synced-lyrics-container ${className}`}
      onWheel={handleWheel}
      onClick={(e) => {
        // If clicking background/empty area and onClose provided, close lyrics
        if (e.target === containerRef.current && onClose) {
          onClose();
        }
      }}
      style={{
        width: '100%',
        height: '100%',
        maxHeight: isLeft ? '114px' : '190px',
        overflow: 'hidden',
        position: 'relative',
        maskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
        boxSizing: 'border-box',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {loading && lyrics.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#8c94a8', fontSize: '13px', margin: 'auto' }}>
          <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
            <RefreshCw size={14} />
          </motion.div>
          <span>Fetching lyrics...</span>
        </div>
      )}

      {!loading && error && lyrics.length === 0 && !plainLyrics && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#8c94a8', fontSize: '12px', margin: 'auto' }}>
          <Music size={14} style={{ opacity: 0.5 }} />
          <span>Instrumental or lyrics unavailable</span>
        </div>
      )}

      {!loading && plainLyrics && lyrics.length === 0 && (
        <div style={{ whiteSpace: 'pre-line', textAlign: isLeft ? 'left' : 'center', color: '#8c94a8', fontSize: '13px', lineHeight: '1.8', overflowY: 'auto' }}>
          {plainLyrics}
        </div>
      )}

      <div
        className="synced-lyrics-list"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: isLeft ? 'flex-start' : 'center',
          gap: isLeft ? '6px' : '10px',
          width: '100%',
          transform: `translate3d(0, ${effectiveTranslateY}px, 0)`,
          transition: isUserScrolling ? 'none' : 'transform 0.42s cubic-bezier(0.25, 1, 0.5, 1)',
          willChange: 'transform',
          boxSizing: 'border-box',
          padding: isLeft ? '0 14px 0 6px' : '0 12px',
        }}
      >
        {lyrics.map((line, idx) => {
          const isActive = idx === activeIndex;
          const isPassed = idx < activeIndex;

          return (
            <div
              key={`${line.timeMs}-${idx}`}
              ref={(el) => { lineRefs.current[idx] = el; }}
              onClick={(e) => {
                e.stopPropagation();
                onSeek?.(line.timeMs);
              }}
              style={{
                cursor: onSeek ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                width: isLeft ? '100%' : 'auto',
                padding: isLeft ? '3px 8px 3px 2px' : '4px 10px',
                borderRadius: '6px',
                backgroundColor: isActive ? 'rgba(255, 255, 255, 0.06)' : 'transparent',
                transition: 'background-color 0.22s ease, opacity 0.22s ease',
                flexShrink: 0,
                boxSizing: 'border-box',
                opacity: isActive ? 1 : isPassed ? 0.35 : 0.52,
              }}
            >
              {/* Visual singing indicator pill: constant width slot ensures text never shifts */}
              {isLeft && (
                <div
                  style={{
                    width: '3.5px',
                    height: '14px',
                    borderRadius: '2px',
                    backgroundColor: '#ffffff',
                    boxShadow: isActive ? '0 0 10px rgba(255, 255, 255, 0.9)' : 'none',
                    marginRight: '8px',
                    opacity: isActive ? 1 : 0,
                    transform: isActive ? 'scaleY(1)' : 'scaleY(0.4)',
                    transition: 'opacity 0.22s ease, transform 0.22s ease, box-shadow 0.22s ease',
                    flexShrink: 0,
                  }}
                />
              )}

              <span
                style={{
                  fontWeight: isActive ? 750 : 500,
                  fontSize: isActive ? '14.5px' : '13px',
                  color: isActive ? '#ffffff' : isPassed ? '#727e91' : '#9ca3af',
                  textShadow: isActive ? '0 0 14px rgba(255, 255, 255, 0.45)' : 'none',
                  letterSpacing: isActive ? '-0.01em' : 'normal',
                  lineHeight: 1.35,
                  transition: 'color 0.22s ease, font-size 0.22s ease, font-weight 0.22s ease, text-shadow 0.22s ease',
                  whiteSpace: 'normal',
                }}
              >
                {line.text}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};
