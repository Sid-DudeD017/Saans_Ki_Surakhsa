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
  ctx.fillStyle = '#e0f2fe';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#fecdd3';
  ctx.fillRect(0, height - 22, width, 22);
  ctx.fillStyle = '#9f1239';
  ctx.font = '12px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('🫁', width / 2, height - 6);
  for (const p of game.particles) {
    ctx.beginPath();
    ctx.fillStyle = 'rgba(71, 85, 105, 0.85)';
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  const half = FILTER.width / 2;
  ctx.fillStyle = CATEGORY_COLOURS[game.category].fill;
  ctx.strokeStyle = '#1f2937';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(game.filterX - half, FILTER.y, FILTER.width, FILTER.height, 5);
  ctx.fill();
  ctx.stroke();
  ctx.strokeStyle = 'rgba(31, 41, 55, 0.5)';
  ctx.lineWidth = 1;
  for (let x = game.filterX - half + 8; x < game.filterX + half; x += 8) {
    ctx.beginPath();
    ctx.moveTo(x, FILTER.y + 2);
    ctx.lineTo(x, FILTER.y + FILTER.height - 2);
    ctx.stroke();
  }
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
    <section aria-labelledby="filter-frenzy-title" style={{ display: 'grid', gap: '0.75rem' }}>
      <h3 id="filter-frenzy-title" style={{ margin: 0, fontSize: '1.1rem', color: '#0f172a' }}>🎮 {W.title[language]}</h3>
      <p style={{ margin: 0, fontSize: '0.95rem', color: '#334155' }}>{W.how[language]}</p>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '1rem', fontVariantNumeric: 'tabular-nums', color: '#0f172a' }} aria-live="off">
        <span>⏱ {W.time[language]}: <strong>{view.timeLeft}</strong></span>
        <span>✅ {W.caught[language]}: <strong>{view.caught}</strong></span>
        <span>💨 {W.missed[language]}: <strong>{view.missed}</strong></span>
        {view.hidden && playing && <span>⏸ {W.paused[language]}</span>}
      </div>
      <div style={{ position: 'relative', width: '100%', maxWidth: '20rem' }}>
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
          style={{ width: '100%', aspectRatio: `${WORLD.width} / ${WORLD.height}`, display: 'block', borderRadius: '0.75rem', border: '2px solid #0f172a', touchAction: 'none', outlineOffset: 3 }}
        />
        {!playing && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(255,255,255,0.88)', borderRadius: '0.75rem', textAlign: 'center' }}>
            <div style={{ display: 'grid', gap: '0.75rem', justifyItems: 'center' }}>
              {view.phase === 'over' && (
                <>
                  <div style={{ fontSize: '0.95rem', color: '#334155' }}>{W.result[language]}</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 900, color: '#0f172a' }}>{rate}%</div>
                  <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5, color: '#0f172a' }}>💡 {W[tipFor(category)][language]}</p>
                </>
              )}
              <Button size="lg" onClick={start}>{view.phase === 'over' ? W.again[language] : W.start[language]}</Button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
