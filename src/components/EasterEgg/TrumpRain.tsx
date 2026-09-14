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
 * onCountryClick) briefly rains his official White House portrait down the
 * screen (see public/easter-egg/README.md for its source/license). Pure CSS
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
          <img src="/easter-egg/trump-headshot.jpg" alt="" width={200} height={200} draggable={false} />
        </span>
      ))}
    </div>
  );
}
