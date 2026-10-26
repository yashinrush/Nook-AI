import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';

interface NotchEyesProps {
  size?: 'compact' | 'normal';
  interactive?: boolean;
  onEyesClick?: () => void;
  className?: string;
}

export const NotchEyes: React.FC<NotchEyesProps> = ({
  size = 'compact',
  interactive = true,
  onEyesClick,
  className = '',
}) => {
  const [isBlinking, setIsBlinking] = useState(false);
  const [expression, setExpression] = useState<'normal' | 'happy' | 'wink' | 'curious'>('normal');
  const [lookOffset, setLookOffset] = useState({ x: 0, y: 0 });
  const eyesRef = useRef<HTMLDivElement>(null);

  // Periodic natural blinking
  useEffect(() => {
    let blinkTimeout: ReturnType<typeof setTimeout>;

    const scheduleBlink = () => {
      // Random interval between 3.5s and 6s
      const delay = 3500 + Math.random() * 2500;
      blinkTimeout = setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => {
          setIsBlinking(false);
          scheduleBlink();
        }, 180);
      }, delay);
    };

    scheduleBlink();

    return () => {
      clearTimeout(blinkTimeout);
    };
  }, []);

  // Track cursor position relative to the eyes if interactive
  useEffect(() => {
    if (!interactive) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!eyesRef.current) return;
      const rect = eyesRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = e.clientX - centerX;
      const deltaY = e.clientY - centerY;
      const dist = Math.hypot(deltaX, deltaY);

      if (dist < 400) {
        // Subtle gaze tracking up to 2.5px
        const maxOffset = size === 'compact' ? 1.8 : 3;
        const factor = Math.min(dist / 300, 1);
        setLookOffset({
          x: (deltaX / (dist || 1)) * maxOffset * factor,
          y: (deltaY / (dist || 1)) * maxOffset * factor,
        });
      } else {
        setLookOffset({ x: 0, y: 0 });
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [interactive, size]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onEyesClick) {
      onEyesClick();
      return;
    }

    // Cycle through playful expressions
    const moods: ('happy' | 'wink' | 'curious')[] = ['happy', 'wink', 'curious'];
    const nextMood = moods[Math.floor(Math.random() * moods.length)];
    setExpression(nextMood);

    setTimeout(() => {
      setExpression('normal');
    }, 1200);
  };

  const isCompact = size === 'compact';
  const eyeWidth = isCompact ? 7 : 11;
  const eyeHeight = isCompact ? 7 : 11;
  const gap = isCompact ? 5 : 8;

  return (
    <div
      ref={eyesRef}
      className={`nusa-notch-eyes ${className}`}
      onClick={handleClick}
      title="Nusa Mascot — click to interact!"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: `${gap}px`,
        cursor: interactive ? 'pointer' : 'default',
        padding: '2px 4px',
        userSelect: 'none',
      }}
    >
      {/* Left Eye */}
      <motion.div
        animate={{
          scaleY: isBlinking || expression === 'wink' ? 0.1 : expression === 'happy' ? 0.35 : 1,
          scaleX: expression === 'curious' ? 1.2 : 1,
          x: lookOffset.x,
          y: lookOffset.y + (expression === 'happy' ? -1 : 0),
          borderRadius: expression === 'happy' ? '50% 50% 10% 10%' : '50%',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        style={{
          width: `${eyeWidth}px`,
          height: `${eyeHeight}px`,
          backgroundColor: '#ffffff',
          borderRadius: '50%',
          boxShadow: isCompact
            ? '0 0 5px 1px rgba(25, 184, 255, 0.75), 0 0 10px 2px rgba(45, 91, 255, 0.4)'
            : '0 0 8px 2px rgba(25, 184, 255, 0.8), 0 0 16px 4px rgba(45, 91, 255, 0.5)',
        }}
      />

      {/* Right Eye */}
      <motion.div
        animate={{
          scaleY: isBlinking ? 0.1 : expression === 'happy' ? 0.35 : 1,
          scaleX: expression === 'curious' ? 0.9 : 1,
          x: lookOffset.x,
          y: lookOffset.y + (expression === 'happy' ? -1 : 0),
          borderRadius: expression === 'happy' ? '50% 50% 10% 10%' : '50%',
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        style={{
          width: `${eyeWidth}px`,
          height: `${eyeHeight}px`,
          backgroundColor: '#ffffff',
          borderRadius: '50%',
          boxShadow: isCompact
            ? '0 0 5px 1px rgba(25, 184, 255, 0.75), 0 0 10px 2px rgba(45, 91, 255, 0.4)'
            : '0 0 8px 2px rgba(25, 184, 255, 0.8), 0 0 16px 4px rgba(45, 91, 255, 0.5)',
        }}
      />
    </div>
  );
};
