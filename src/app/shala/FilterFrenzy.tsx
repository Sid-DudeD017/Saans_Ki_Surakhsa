'use client';

// Filter Frenzy (P2): catch the smoke with a filter for 60 seconds. Drag, tap, or use the arrow keys.
// Today's air sets how much smoke falls; the game pauses when the tab is hidden.
import React, { useCallback, useEffect, useRef, useState } from 'react';

import { Button } from '../../components/ui';
import { CATEGORY_COLOURS, type Category, type Language } from './airQuality';
import { FILTER, WORLD, catchRate, newGame, seeded, step, tipFor, type Game } from './frenzyRules';

type Words = Record<Language, string>;
const W = {
  title: { pa: 'ਫਿਲਟਰ ਫ਼ਰੈਂਜ਼ੀ', hi: 'फ़िल्टर फ़्रेंज़ी', en: 'Filter Frenzy' },
  how: {
    pa: 'ਧੂੰਏਂ ਦੇ ਕਣ ਫੇਫੜਿਆਂ ਤੱਕ ਪਹੁੰਚਣ ਤੋਂ ਪਹਿਲਾਂ ਫਿਲਟਰ ਨਾਲ ਫੜੋ। ਉਂਗਲ ਨਾਲ ਖਿੱਚੋ ਜਾਂ ← → ਦਬਾਓ।',
    hi: 'धुएँ के कणों को फेफड़ों तक पहुँचने से पहले फ़िल्टर से पकड़ो। उँगली से खींचो या ← → दबाओ।',
    en: 'Catch the smoke with the filter before it reaches the lungs. Drag with your finger, or press ← →.',
  },
  start: { pa: 'ਸ਼ੁਰੂ ਕਰੋ', hi: 'शुरू करें', en: 'Start' },
  again: { pa: 'ਫਿਰ ਖੇਡੋ', hi: 'फिर खेलें', en: 'Play again' },
  paused: { pa: 'ਰੁਕੀ ਹੋਈ', hi: 'रुकी हुई', en: 'Paused' },
  caught: { pa: 'ਫੜੇ', hi: 'पकड़े', en: 'Caught' },
  missed: { pa: 'ਛੁੱਟੇ', hi: 'छूटे', en: 'Missed' },
  time: { pa: 'ਸਮਾਂ', hi: 'समय', en: 'Time' },
  result: { pa: 'ਤੁਸੀਂ ਧੂੰਏਂ ਦਾ ਇੰਨਾ ਹਿੱਸਾ ਫੜਿਆ', hi: 'आपने धुएँ का इतना हिस्सा पकड़ा', en: 'You caught this much of the smoke' },
  mask: {
    pa: 'ਚੰਗੀ ਤਰ੍ਹਾਂ ਫਿੱਟ N95 ਮਾਸਕ ਧੂੰਏਂ ਦੇ ਜ਼ਿਆਦਾਤਰ ਛੋਟੇ ਕਣ ਰੋਕ ਲੈਂਦਾ ਹੈ। ਕੱਪੜੇ ਦਾ ਮਾਸਕ ਬਹੁਤ ਘੱਟ ਰੋਕਦਾ ਹੈ।',
    hi: 'अच्छी तरह फ़िट N95 मास्क धुएँ के ज़्यादातर छोटे कण रोक लेता है। कपड़े का मास्क बहुत कम रोकता है।',
    en: 'A well-fitting N95 mask stops most tiny smoke particles. A cloth mask stops far fewer.',
  },
  purifier: {
    pa: 'HEPA ਫਿਲਟਰ ਵਾਲਾ ਪਿਊਰੀਫਾਇਰ ਬੰਦ ਕਮਰੇ ਦੀ ਹਵਾ ਸਾਫ਼ ਕਰਦਾ ਹੈ। ਇਹ ਚੱਲਦਾ ਹੋਵੇ ਤਾਂ ਖਿੜਕੀਆਂ ਬੰਦ ਰੱਖੋ।',
    hi: 'HEPA फ़िल्टर वाला प्यूरीफायर बंद कमरे की हवा साफ़ करता है। जब यह चले तो खिड़कियाँ बंद रखें।',
    en: 'A purifier with a HEPA filter cleans the air in a closed room. Keep the windows shut while it runs.',
  },
} satisfies Record<string, Words>;

function draw(ctx: CanvasRenderingContext2D, game: Game, scale: number) {
  const { width, height } = WORLD;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);

  // Clean sky gradient background
  const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
  bgGrad.addColorStop(0, '#f0f9ff');
  bgGrad.addColorStop(1, '#e0f2fe');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, width, height);

  // Bottom Lung Zone (Protected respiratory area)
  ctx.fillStyle = '#ffe4e6';
  ctx.fillRect(0, height - 32, width, 32);
  ctx.strokeStyle = '#fda4af';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, height - 32);
  ctx.lineTo(width, height - 32);
  ctx.stroke();

  // Lung emoji & label
  ctx.font = '16px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🫁', width / 2 - 40, height - 16);
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillStyle = '#9f1239';
  ctx.fillText('Protected Lungs', width / 2 + 10, height - 16);

  // Smoke Particles (PM2.5 soot particles with inner gradient)
  for (const p of game.particles) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(51, 65, 85, 0.88)';
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle dark soot border
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // Filter / N95 Mask Paddle
  const half = FILTER.width / 2;
  const filterY = FILTER.y;
  const filterH = FILTER.height;

  // Mask body with slight arc
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#0284c7';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(game.filterX - half, filterY, FILTER.width, filterH, 6);
  ctx.fill();
  ctx.stroke();

  // N95 pleats / texture lines
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1;
  for (let x = game.filterX - half + 10; x < game.filterX + half; x += 10) {
    ctx.beginPath();
    ctx.moveTo(x, filterY + 2);
    ctx.lineTo(x, filterY + filterH - 2);
    ctx.stroke();
  }

  // N95 blue badge on filter center
  ctx.fillStyle = '#0284c7';
  ctx.beginPath();
  ctx.roundRect(game.filterX - 14, filterY + 2, 28, filterH - 4, 3);
  ctx.fill();
  ctx.font = 'bold 8px system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('N95', game.filterX, filterY + filterH / 2);
}

export function FilterFrenzy({ category, language }: { category: Category; language: Language }) {
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const game = useRef<Game>(newGame(category));
  const keys = useRef<{ left: boolean; right: boolean }>({ left: false, right: false });
  const target = useRef<number | null>(null);
  const random = useRef<() => number>(seeded(1));
  const [view, setView] = useState<{ phase: 'ready' | 'playing' | 'over'; caught: number; missed: number; timeLeft: number; hidden: boolean }>({
    phase: 'ready', caught: 0, missed: 0, timeLeft: 60, hidden: false,
  });
  const playing = view.phase === 'playing';

  const paint = useCallback(() => {
    const c = canvas.current;
    const ctx = c?.getContext('2d');
    if (!c || !ctx) return;
    const scale = c.width / WORLD.width;
    draw(ctx, game.current, scale);
  }, []);

  // Size the canvas to its box, at the screen's pixel density.
  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const fit = () => {
      const w = c.clientWidth * (window.devicePixelRatio || 1);
      c.width = Math.round(w);
      c.height = Math.round((w * WORLD.height) / WORLD.width);
      paint();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(c);
    return () => ro.disconnect();
  }, [paint]);

  useEffect(() => {
    if (view.phase === 'ready') {
      game.current = newGame(category);
      paint();
    }
  }, [category, view.phase, paint]);

  useEffect(() => {
    if (!playing) return;
    let frame = 0;
    let last = performance.now();
    let shown = 0;
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      if (!document.hidden) {
        const move = keys.current.left === keys.current.right ? 0 : keys.current.left ? -1 : 1;
        game.current = step(game.current, dt, { move, target: target.current }, random.current);
        paint();
        if (now - shown > 200 || game.current.over) {
          shown = now;
          const g = game.current;
          setView((v) => ({ ...v, caught: g.caught, missed: g.missed, timeLeft: Math.ceil(g.timeLeft), phase: g.over ? 'over' : 'playing' }));
        }
      }
      if (!game.current.over) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const onVisibility = () => {
      last = performance.now();
      setView((v) => ({ ...v, hidden: document.hidden }));
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [playing, paint]);

  const start = () => {
    random.current = seeded(Date.now());
    game.current = newGame(category);
    target.current = null;
    setView({ phase: 'playing', caught: 0, missed: 0, timeLeft: 60, hidden: document.hidden });
    canvas.current?.focus();
  };

  const toWorld = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const box = e.currentTarget.getBoundingClientRect();
    return ((e.clientX - box.left) / box.width) * WORLD.width;
  };

  const key = (e: React.KeyboardEvent, down: boolean) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    target.current = null;
    keys.current[e.key === 'ArrowLeft' ? 'left' : 'right'] = down;
  };

  const rate = catchRate(view);
  return (
    <section
      aria-labelledby="filter-frenzy-title"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        textAlign: 'center',
        gap: '0.85rem',
        width: '100%',
      }}
    >
      <div style={{ maxWidth: '28rem' }}>
        <h3 id="filter-frenzy-title" style={{ margin: '0 0 0.25rem', fontSize: '1.2rem', color: '#0f172a', fontWeight: 800 }}>
          🎮 {W.title[language]}
        </h3>
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#475569', lineHeight: 1.45 }}>
          {W.how[language]}
        </p>
      </div>

      {/* Centered tactile stats bar */}
      <div
        style={{
          display: 'flex',
          gap: '1.25rem',
          justifyContent: 'center',
          alignItems: 'center',
          flexWrap: 'wrap',
          fontSize: '0.95rem',
          fontVariantNumeric: 'tabular-nums',
          backgroundColor: '#f8fafc',
          padding: '0.4rem 1rem',
          borderRadius: '9999px',
          border: '1px solid #e2e8f0',
          color: '#0f172a',
        }}
        aria-live="off"
      >
        <span>⏱ {W.time[language]}: <strong>{view.timeLeft}s</strong></span>
        <span>🛡️ {W.caught[language]}: <strong style={{ color: '#16a34a' }}>{view.caught}</strong></span>
        <span>💨 {W.missed[language]}: <strong style={{ color: '#dc2626' }}>{view.missed}</strong></span>
        {view.hidden && playing && <span style={{ color: '#d97706' }}>⏸ {W.paused[language]}</span>}
      </div>

      {/* Centered Canvas Frame */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '22rem',
          margin: '0 auto',
          boxShadow: '0 8px 25px -4px rgba(15, 23, 42, 0.12)',
          borderRadius: '1rem',
          overflow: 'hidden',
          border: '3px solid #0f172a',
        }}
      >
        <canvas
          ref={canvas}
          tabIndex={0}
          aria-label={`${W.title[language]}: ${W.how[language]}`}
          onKeyDown={(e) => key(e, true)}
          onKeyUp={(e) => key(e, false)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            target.current = toWorld(e);
          }}
          onPointerMove={(e) => {
            if (e.buttons || e.pointerType === 'touch') target.current = toWorld(e);
          }}
          onPointerUp={() => {
            target.current = null;
          }}
          style={{
            width: '100%',
            aspectRatio: `${WORLD.width} / ${WORLD.height}`,
            display: 'block',
            touchAction: 'none',
            outlineOffset: 3,
            backgroundColor: '#f0f9ff',
          }}
        />
        {!playing && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'grid',
              placeItems: 'center',
              padding: '1.5rem',
              background: 'rgba(255,255,255,0.92)',
              backdropFilter: 'blur(3px)',
              textAlign: 'center',
            }}
          >
            <div style={{ display: 'grid', gap: '1rem', justifyItems: 'center', maxWidth: '18rem' }}>
              {view.phase === 'over' ? (
                <>
                  <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#475569' }}>
                    {W.result[language]}
                  </div>
                  <div style={{ fontSize: '3rem', fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                    {rate}%
                  </div>
                  <div
                    style={{
                      fontSize: '0.875rem',
                      lineHeight: 1.45,
                      color: '#0f172a',
                      backgroundColor: '#f0fdf4',
                      padding: '0.6rem 0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid #bbf7d0',
                    }}
                  >
                    💡 {W[tipFor(category)][language]}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.9rem', color: '#334155', fontWeight: 500 }}>
                  👉 Drag your finger or mouse left & right to protect lungs from smoke!
                </div>
              )}
              <Button
                size="lg"
                variant="primary"
                onClick={start}
                style={{
                  minHeight: '48px',
                  paddingLeft: '2rem',
                  paddingRight: '2rem',
                  borderRadius: '9999px',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.35)',
                }}
              >
                {view.phase === 'over' ? `🔄 ${W.again[language]}` : `▶ ${W.start[language]}`}
              </Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
