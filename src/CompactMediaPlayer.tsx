import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { invoke } from '@tauri-apps/api/core';
import { Visualizer } from './App';
import { PlayIcon, PauseIcon, SkipBackIcon, SkipForwardIcon, MusicNoteIcon, SpeakerIcon, AudioOutputIcon, VolumeLowIcon, VolumeHighIcon } from './icons';
import { SyncedLyrics } from './components/SyncedLyrics';
import { X } from 'lucide-react';

interface MediaInfo {
  title: string;
  artist: string;
  is_playing: boolean;
  has_media: boolean;
  artwork?: string[];
  position_ms?: number;
  duration_ms?: number;
  seek_enabled?: boolean;
  position_updated_at?: number;
}

interface CompactMediaPlayerProps {
  mediaInfo: MediaInfo;
  albumArtUrl: string | null;
  albumArtKey: number;
  isPlaying: boolean;
  volume: number;
  volumeExpanded: boolean;
  onVolumeExpandedChange: (expanded: boolean) => void;
  onTogglePlayPause: () => void;
  onVolumeChange: (vol: number) => void;
  prevFront: ReturnType<typeof useAnimation>;
  prevBack: ReturnType<typeof useAnimation>;
  nextFront: ReturnType<typeof useAnimation>;
  nextBack: ReturnType<typeof useAnimation>;
  onAnimatePrev: () => void;
  onAnimateNext: () => void;
  onLayoutChange: (layout: 'classic' | 'compact') => void;
  lyricsExpanded?: boolean;
  onLyricsExpandedChange?: (expanded: boolean) => void;
}

const MARQUEE_SPEED = 30;
const MARQUEE_MIN_DURATION = 5;

function TitleMarquee({ title }: { title: string }) {
  const textRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const [scrollDistance, setScrollDistance] = useState(0);
  const [scrollDuration, setScrollDuration] = useState(8);

  useEffect(() => {
    const check = () => {
      if (textRef.current && containerRef.current) {
        const textWidth = textRef.current.scrollWidth;
        const containerWidth = containerRef.current.clientWidth;
        const overflow = textWidth > containerWidth;
        setIsOverflowing(overflow);
        if (overflow) {
          const distance = textWidth - containerWidth;
          setScrollDistance(distance);
          setScrollDuration(Math.max(distance / MARQUEE_SPEED, MARQUEE_MIN_DURATION));
        }
      }
    };
    check();
    const observer = new ResizeObserver(check);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [title]);

  return (
    <div ref={containerRef} className="cmp-marquee-wrap">
      <span
        ref={textRef}
        className={`cmp-title ${isOverflowing ? 'cmp-marquee' : ''}`}
        style={{
          '--scroll-distance': isOverflowing ? `-${scrollDistance}px` : undefined,
          '--scroll-duration': `${scrollDuration}s`,
        } as React.CSSProperties}
      >
        {title}
      </span>
    </div>
  );
}

function formatTime(ms: number): string {
  if (ms <= 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatRemaining(elapsed: number, duration: number): string {
  const remaining = Math.max(0, duration - elapsed);
  const totalSeconds = Math.floor(remaining / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `-${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function LyricsBubbleIcon({ size = 18, active = false }: { size?: number; active?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M20 11.5C20 6.8 16.42 3 12 3C7.58 3 4 6.8 4 11.5C4 13.56 4.78 15.44 6.07 16.87L4.5 21L9.04 19.84C9.97 20.26 10.96 20.5 12 20.5C16.42 20.5 20 16.7 20 11.5Z"
        fill={active ? "#ffffff" : "none"}
        stroke={active ? "#ffffff" : "currentColor"}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9.5" cy="11.5" r="1.3" fill={active ? "#090d16" : "currentColor"} />
      <circle cx="14.5" cy="11.5" r="1.3" fill={active ? "#090d16" : "currentColor"} />
    </svg>
  );
}

function PaperSkyCover() {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'linear-gradient(135deg, #e4ecf7 0%, #cbd9ec 100%)',
        borderRadius: '10px',
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
      }}
    >
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-evenly', opacity: 0.35 }}>
        <div style={{ height: '1px', background: '#476f9d' }} />
        <div style={{ height: '1px', background: '#476f9d' }} />
        <div style={{ height: '1px', background: '#476f9d' }} />
        <div style={{ height: '1px', background: '#476f9d' }} />
        <div style={{ height: '1px', background: '#476f9d' }} />
      </div>
      <div
        style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          border: '2px solid #258cfb',
          backgroundColor: '#1b70db',
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(37, 140, 251, 0.4)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: '30px',
            height: '2px',
            backgroundColor: '#ffffff',
            transform: 'rotate(-45deg)',
          }}
        />
      </div>
    </div>
  );
}

export function CompactMediaPlayer({
  mediaInfo,
  albumArtUrl,
  albumArtKey,
  isPlaying,
  volume,
  volumeExpanded,
  onVolumeExpandedChange,
  onTogglePlayPause,
  onVolumeChange,
  prevFront,
  prevBack,
  nextFront,
  nextBack,
  onAnimatePrev,
  onAnimateNext,
  onLayoutChange,
  lyricsExpanded = false,
  onLyricsExpandedChange,
}: CompactMediaPlayerProps) {
  const [internalLyrics, setInternalLyrics] = useState(false);
  const isLyricsOpen = onLyricsExpandedChange ? lyricsExpanded : internalLyrics;
  const toggleLyrics = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (onLyricsExpandedChange) onLyricsExpandedChange(!lyricsExpanded);
    else setInternalLyrics(!internalLyrics);
  };

  const seekRef = useRef<HTMLInputElement>(null);

  const positionMs = mediaInfo.position_ms ?? 0;
  const durationMs = mediaInfo.duration_ms ?? 0;
  const seekEnabled = mediaInfo.seek_enabled ?? false;

  const isSeekingRef = useRef(false);
  const [displayPosition, setDisplayPosition] = useState(positionMs);
  const lastTickRef = useRef<number>(Date.now());

  // Update displayPosition when backend sends new position (unless actively dragging seek bar)
  useEffect(() => {
    if (!isSeekingRef.current) {
      setDisplayPosition(positionMs);
      lastTickRef.current = Date.now();
    }
  }, [positionMs]);

  // Reset ticker anchor whenever isPlaying changes
  useEffect(() => {
    lastTickRef.current = Date.now();
  }, [isPlaying]);

  // Smooth position ticker: advance displayPosition while playing
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      if (isSeekingRef.current) return;
      const now = Date.now();
      const delta = now - lastTickRef.current;
      lastTickRef.current = now;

      setDisplayPosition((prev) => {
        const next = prev + delta;
        if (durationMs > 0 && next >= durationMs) {
          return 0; // loop track if reached end
        }
        return next;
      });
    }, 150);

    return () => clearInterval(interval);
  }, [isPlaying, durationMs]);

  // Seek handlers
  const handleSeekStart = useCallback(() => {
    isSeekingRef.current = true;
  }, []);

  const handleSeekChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setDisplayPosition(Number(e.target.value));
  }, []);

  const handleSeekEnd = useCallback(() => {
    const seekPos = displayPosition;
    isSeekingRef.current = false;
    lastTickRef.current = Date.now();
    invoke('media_seek', { positionMs: seekPos }).catch(() => {});
  }, [displayPosition]);

  const progressPercent = durationMs > 0 ? (displayPosition / durationMs) * 100 : 0;

  // When lyrics are open: Side-by-side layout matching img 1
  if (isLyricsOpen) {
    return (
      <div
        className="cmp cmp-lyrics-split"
        onWheel={(e) => {
          const target = e.target as HTMLElement;
          // Only scroll-to-exit if wheel is NOT on the lyrics list itself
          if (!target.closest('.synced-lyrics-list')) {
            e.stopPropagation();
            const delta = Math.abs(e.deltaY) > Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
            if (Math.abs(delta) >= 8) {
              toggleLyrics();
            }
          }
        }}
        style={{
          display: 'flex',
          flexDirection: 'row',
          width: '100%',
          height: '100%',
          alignItems: 'center',
          boxSizing: 'border-box',
          padding: '6px 10px',
        }}
      >
        {/* Left column (Player Card matching img 1) */}
        <div
          style={{
            width: '235px',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            height: '100%',
            padding: '2px 4px',
            boxSizing: 'border-box',
          }}
        >
          {/* Top: Art + Title / Artist */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '46px',
                height: '46px',
                borderRadius: '10px',
                overflow: 'hidden',
                flexShrink: 0,
                background: 'rgba(255,255,255,0.08)',
                boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              }}
            >
              {albumArtUrl ? (
                <img
                  src={albumArtUrl}
                  alt="Art"
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <PaperSkyCover />
              )}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: '2px' }}>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mediaInfo.title || 'Paper Sky'}
              </div>
              <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {mediaInfo.artist || 'Lumen Coast - Summer Echoes'}
              </div>
            </div>
          </div>

          {/* Middle: Progress row with times (matching img 1) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0' }}>
            <span style={{ fontSize: '11px', color: '#8c94a8', minWidth: '28px', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(displayPosition)}
            </span>
            <div className="cmp-track-bar" style={{ flex: 1, height: '3px' }}>
              <div className="cmp-track-fill" style={{ width: `${progressPercent}%` }} />
              {seekEnabled && (
                <input
                  ref={seekRef}
                  type="range"
                  className="cmp-seek"
                  min={0}
                  max={durationMs}
                  step={100}
                  value={displayPosition}
                  onMouseDown={handleSeekStart}
                  onTouchStart={handleSeekStart}
                  onChange={handleSeekChange}
                  onMouseUp={handleSeekEnd}
                  onTouchEnd={handleSeekEnd}
                  onClick={(e) => e.stopPropagation()}
                />
              )}
            </div>
            <span style={{ fontSize: '11px', color: '#8c94a8', minWidth: '32px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {formatRemaining(displayPosition, durationMs)}
            </span>
          </div>

          {/* Bottom: Lyrics Speech Bubble (left) + Controls (center/right) matching img 1 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingRight: '8px' }}>
            {/* Lyrics toggle speech bubble button - clicking closes lyrics */}
            <motion.button
              className="cmp-btn active"
              onClick={toggleLyrics}
              whileTap={{ scale: 0.9 }}
              title="Close Lyrics"
              style={{
                color: '#ffffff',
                background: 'none',
                border: 'none',
                padding: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <LyricsBubbleIcon size={19} active={true} />
            </motion.button>

            {/* Playback Controls (clean solid icons matching Image 1) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginRight: '6px' }}>
              <motion.button
                onClick={(e) => { e.stopPropagation(); onAnimatePrev(); }}
                whileTap={{ scale: 0.88 }}
                title="Previous"
                style={{ background: 'none', border: 'none', color: '#ffffff', opacity: 0.85, cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M11 5L2 12L11 19V5Z" />
                  <path d="M22 5L13 12L22 19V5Z" />
                </svg>
              </motion.button>

              <motion.button
                onClick={(e) => { e.stopPropagation(); onTogglePlayPause(); }}
                whileTap={{ scale: 0.88 }}
                title={isPlaying ? "Pause" : "Play"}
                style={{ background: 'none', border: 'none', color: '#ffffff', opacity: 0.95, cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                {isPlaying ? (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="5" y="4" width="4" height="16" rx="1.5" />
                    <rect x="15" y="4" width="4" height="16" rx="1.5" />
                  </svg>
                ) : (
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M6 4L19 12L6 20V4Z" />
                  </svg>
                )}
              </motion.button>

              <motion.button
                onClick={(e) => { e.stopPropagation(); onAnimateNext(); }}
                whileTap={{ scale: 0.88 }}
                title="Next"
                style={{ background: 'none', border: 'none', color: '#ffffff', opacity: 0.85, cursor: 'pointer', padding: '2px', display: 'flex' }}
              >
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 5L11 12L2 19V5Z" />
                  <path d="M13 5L22 12L13 19V5Z" />
                </svg>
              </motion.button>
            </div>
          </div>
        </div>

        {/* Vertical divider */}
        <div style={{ width: '1px', height: '72%', background: 'rgba(255, 255, 255, 0.12)', margin: '0 10px', flexShrink: 0 }} />

        {/* Right column: Synced Lyrics (matching img 1) */}
        <div
          style={{
            flex: 1,
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
          }}
        >
          {/* Subtle Close button in upper right */}
          <button
            onClick={(e) => { e.stopPropagation(); toggleLyrics(); }}
            title="Close Lyrics"
            style={{
              position: 'absolute',
              top: '2px',
              right: '4px',
              zIndex: 10,
              background: 'rgba(255, 255, 255, 0.08)',
              border: 'none',
              borderRadius: '50%',
              width: '20px',
              height: '20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'rgba(255, 255, 255, 0.6)',
              cursor: 'pointer',
              transition: 'background 0.2s, color 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = '#ffffff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.6)';
            }}
          >
            <X size={12} />
          </button>

          <SyncedLyrics
            align="left"
            title={mediaInfo.title}
            artist={mediaInfo.artist}
            durationMs={durationMs}
            positionMs={displayPosition}
            isPlaying={isPlaying}
            onSeek={(pos) => {
              setDisplayPosition(pos);
              lastTickRef.current = Date.now();
              invoke('media_seek', { positionMs: pos }).catch(() => {});
            }}
            onClose={() => toggleLyrics()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="cmp">
      {/* Row 1: Album art + Title/Artist + Visualizer */}
      <div className="cmp-row cmp-row-info">
        <div className="cmp-art" onClick={(e) => { e.stopPropagation(); onLayoutChange('classic'); }} style={{ cursor: 'pointer' }}>
          <AnimatePresence mode="wait" initial={false}>
            {albumArtUrl ? (
              <motion.img
                key={`art-${albumArtKey}`}
                src={albumArtUrl}
                alt="Art"
                draggable={false}
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              />
            ) : (
              <motion.div
                key="placeholder"
                className="cmp-art-placeholder"
                initial={{ rotateY: 90, opacity: 0 }}
                animate={{ rotateY: 0, opacity: 1 }}
                exit={{ rotateY: -90, opacity: 0 }}
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <MusicNoteIcon size={22} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="cmp-track">
          <TitleMarquee title={mediaInfo.title} />
          <span className="cmp-artist">{mediaInfo.artist}</span>
        </div>
        <div className="cmp-visualizer">
          <Visualizer isPlaying={isPlaying} bars={5} height={16} />
        </div>
      </div>

      {/* Row 2: Progress bar */}
      {durationMs > 0 && (
        <div className="cmp-row cmp-row-progress">
          <span className="cmp-time">{formatTime(displayPosition)}</span>
          <div className="cmp-track-bar">
            <div className="cmp-track-fill" style={{ width: `${progressPercent}%` }} />
            {seekEnabled && (
              <input
                ref={seekRef}
                type="range"
                className="cmp-seek"
                min={0}
                max={durationMs}
                step={100}
                value={displayPosition}
                onMouseDown={handleSeekStart}
                onTouchStart={handleSeekStart}
                onChange={handleSeekChange}
                onMouseUp={handleSeekEnd}
                onTouchEnd={handleSeekEnd}
                onClick={(e) => e.stopPropagation()}
              />
            )}
          </div>
          <span className="cmp-time">{formatRemaining(displayPosition, durationMs)}</span>
        </div>
      )}

      {/* Row 3: Controls */}
      <div className="cmp-row cmp-row-controls">
        <motion.button
          className="cmp-btn cmp-btn-side"
          onClick={(e) => { e.stopPropagation(); onVolumeExpandedChange(!volumeExpanded); }}
          whileTap={{ scale: 0.9 }}
          data-tooltip="Volume"
        >
          <SpeakerIcon size={22} muted={volume === 0} />
        </motion.button>

        <div className="cmp-main-controls">
          <motion.button className="cmp-btn" onClick={(e) => { e.stopPropagation(); onAnimatePrev(); }} whileTap={{ scale: 0.9 }}>
            <div className="cmp-slide-wrap">
              <motion.div animate={prevBack} className="cmp-slide-layer"><SkipBackIcon size={30} /></motion.div>
              <motion.div animate={prevFront} className="cmp-slide-layer"><SkipBackIcon size={30} /></motion.div>
            </div>
          </motion.button>

          <motion.button className="cmp-btn cmp-play" onClick={(e) => { e.stopPropagation(); onTogglePlayPause(); }} whileTap={{ scale: 0.95 }}>
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isPlaying ? "pause" : "play"}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.12 }}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                {isPlaying ? <PauseIcon size={26} /> : <PlayIcon size={26} />}
              </motion.div>
            </AnimatePresence>
          </motion.button>

          <motion.button className="cmp-btn" onClick={(e) => { e.stopPropagation(); onAnimateNext(); }} whileTap={{ scale: 0.9 }}>
            <div className="cmp-slide-wrap">
              <motion.div animate={nextBack} className="cmp-slide-layer"><SkipForwardIcon size={30} /></motion.div>
              <motion.div animate={nextFront} className="cmp-slide-layer"><SkipForwardIcon size={30} /></motion.div>
            </div>
          </motion.button>
        </div>

        <motion.button
          className={`cmp-btn cmp-btn-side ${isLyricsOpen ? 'active' : ''}`}
          onClick={toggleLyrics}
          whileTap={{ scale: 0.9 }}
          data-tooltip="Synced Lyrics"
          style={{ color: isLyricsOpen ? '#19b8ff' : undefined }}
        >
          <LyricsBubbleIcon size={20} active={isLyricsOpen} />
        </motion.button>

        <motion.button
          className="cmp-btn cmp-btn-side"
          onClick={(e) => {
            e.stopPropagation();
            invoke('open_sound_settings').catch(() => {});
          }}
          whileTap={{ scale: 0.9 }}
          data-tooltip="Audio Output"
        >
          <AudioOutputIcon size={22} />
        </motion.button>
      </div>

      {/* Volume expansion */}
      <AnimatePresence>
        {volumeExpanded && (
          <motion.div
            className="cmp-expand"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 36, opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          >
            <div className="cmp-volume-row">
              <VolumeLowIcon size={12} style={{ opacity: 0.5, flexShrink: 0 }} />
              <div className="cmp-volume-track">
                <div className="cmp-volume-fill" style={{ width: `${volume * 100}%` }} />
                <input
                  type="range"
                  className="cmp-volume-slider"
                  min={0} max={1} step={0.01} value={volume}
                  onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <VolumeHighIcon size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
