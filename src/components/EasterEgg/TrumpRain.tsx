import { useEffect, useMemo, type CSSProperties } from 'react';
import './trumpRain.css';

interface TrumpRainProps {
  /** Called once every drop has finished falling, so the parent can unmount this overlay. */
  onDone: () => void;
}

interface Drop {
  id: number;
  left: number; // vw
  size: number; // px
  delay: number; // s
  duration: number; // s
  drift: number; // vw, horizontal wander over the fall
  spin: number; // deg, total rotation over the fall
}

const DROP_COUNT = 28;
const MIN_DELAY = 0;
const MAX_DELAY = 1.1;
const MIN_DURATION = 2.6;
const MAX_DURATION = 4.2;

/**
 * A screen-space easter egg: clicking the USA on the globe (see Globe's
 * onCountryClick) briefly rains a caricature down the screen. Pure CSS
 * transform animation (cheap, GPU-composited) — no canvas/WebGL involved,
 * so it layers on top of the globe as a plain fixed overlay.
 */
export function TrumpRain({ onDone }: TrumpRainProps) {
  const drops = useMemo<Drop[]>(
    () =>
      Array.from({ length: DROP_COUNT }, (_, id) => ({
        id,
        left: Math.random() * 100,
        size: 26 + Math.random() * 28,
        delay: MIN_DELAY + Math.random() * (MAX_DELAY - MIN_DELAY),
        duration: MIN_DURATION + Math.random() * (MAX_DURATION - MIN_DURATION),
        drift: Math.random() * 16 - 8,
        spin: Math.random() * 50 - 25,
      })),
    [],
  );

  useEffect(() => {
    const lifetime = (MAX_DELAY + MAX_DURATION + 0.4) * 1000;
    const timer = setTimeout(onDone, lifetime);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div className="trump-rain" aria-hidden="true">
      {drops.map((d) => (
        <span
          key={d.id}
          className="trump-rain__drop"
          style={
            {
              left: `${d.left}vw`,
              width: d.size,
              height: d.size,
              animationDelay: `${d.delay}s`,
              animationDuration: `${d.duration}s`,
              '--drift': `${d.drift}vw`,
              '--spin': `${d.spin}deg`,
            } as CSSProperties
          }
        >
          <TrumpIcon />
        </span>
      ))}
    </div>
  );
}

/** A small stylized caricature — not a photo, just enough to read as the gag at a glance. */
function TrumpIcon() {
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%">
      <circle cx="20" cy="21" r="14" fill="#e6a15c" />
      <path
        d="M6 17 Q14 4 20 8 Q26 4 34 17 Q27 12 20 13 Q13 12 6 17 Z"
        fill="#f0c95e"
      />
      <circle cx="15" cy="21" r="1.6" fill="#3a2a1a" />
      <circle cx="25" cy="21" r="1.6" fill="#3a2a1a" />
      <path d="M16 28 Q20 26 24 28" stroke="#8a4a2a" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <path d="M18 34 L20 39 L22 34 Z" fill="#c23b3b" />
    </svg>
  );
}
