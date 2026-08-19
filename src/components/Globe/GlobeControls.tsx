import { useEffect, useRef, useState } from 'react';
import { SURFACE_OPTIONS, useGlobeStore } from '../../state/globeStore';
import './globeControls.css';

/**
 * Surface picker for the globe sphere itself (imagery vs. flat political fill)
 * plus a brightness dimmer, which is the only lighting control that makes sense
 * for a canvas the CSS theme can't reach.
 */
export function GlobeControls() {
  const surface = useGlobeStore((s) => s.surface);
  const setSurface = useGlobeStore((s) => s.setSurface);
  const brightness = useGlobeStore((s) => s.brightness);
  const setBrightness = useGlobeStore((s) => s.setBrightness);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const active = SURFACE_OPTIONS.find((o) => o.id === surface);

  return (
    <div className="globe-controls" ref={rootRef}>
      <button
        className={`globe-controls__trigger ${open ? 'globe-controls__trigger--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
      >
        <span className="globe-controls__icon" aria-hidden="true">
          ◍
        </span>
        {active?.label ?? 'Surface'}
      </button>

      {open && (
        <div className="globe-controls__panel" role="group" aria-label="Globe surface">
          <p className="globe-controls__heading">Surface</p>
          <div className="globe-controls__options">
            {SURFACE_OPTIONS.map((option) => (
              <button
                key={option.id}
                className={`globe-controls__option ${option.id === surface ? 'globe-controls__option--active' : ''}`}
                onClick={() => setSurface(option.id)}
                aria-pressed={option.id === surface}
              >
                <span className={`globe-controls__swatch globe-controls__swatch--${option.id}`} aria-hidden="true" />
                <span className="globe-controls__option-text">
                  <span className="globe-controls__option-label">{option.label}</span>
                  <span className="globe-controls__option-hint">{option.hint}</span>
                </span>
              </button>
            ))}
          </div>

          <label className="globe-controls__dimmer">
            <span>
              Brightness <span className="globe-controls__dimmer-value">{Math.round(brightness * 100)}%</span>
            </span>
            <input
              type="range"
              min={15}
              max={100}
              step={5}
              value={Math.round(brightness * 100)}
              onChange={(e) => setBrightness(Number(e.target.value) / 100)}
            />
          </label>

          <p className="globe-controls__credit">Imagery: NASA Visible Earth (public domain)</p>
        </div>
      )}
    </div>
  );
}
