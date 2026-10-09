'use client';

// Machine photos (K7, K8): the farmer photographs a machine, the agent cleans the photo and guesses
// which machine it is, and the farmer confirms or corrects it with one tap. Nothing joins "my machines"
// without that tap: a blurry rotavator must not count as a Super Seeder.
import React, { useEffect, useRef, useState } from 'react';

import { Alert, Button, Card } from '../../components/ui';
import { MACHINE_TYPES, describeGuess, farmStore, preselect, type MachineType, type OwnedMachine } from './farmProfile';
import { KisanError, sendPhoto, type Language, type PhotoResponse } from './kisanApi';
import { newId, shrinkPhoto, thumbnail } from './photoPrep';
import { machineLabel, say, sayWith } from './strings';

const GREEN = '#15803d';
const CHOICES: (MachineType | 'other')[] = [...MACHINE_TYPES, 'other'];

type Phase =
  | { at: 'idle' }
  | { at: 'sending'; preview: string; file: File }
  | { at: 'confirm'; preview: string; thumb?: string; result: PhotoResponse }
  | { at: 'failed'; preview: string; file: File; why: string };

const BIG: React.CSSProperties = { minHeight: '3rem', fontSize: '1rem' };

export function MachinePhotos({ language }: { language: Language }) {
  const farm = farmStore.use();
  const [phase, setPhase] = useState<Phase>({ at: 'idle' });
  const [choice, setChoice] = useState<MachineType | 'other' | null>(null);
  const [count, setCount] = useState(1);
  const [owned, setOwned] = useState(true);
  const camera = useRef<HTMLInputElement | null>(null);
  const gallery = useRef<HTMLInputElement | null>(null);
  const preview = 'preview' in phase ? phase.preview : null;

  // Each preview is an object URL; let the browser free it once it's off screen.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  async function send(file: File, shownAs?: string) {
    const url = shownAs ?? URL.createObjectURL(file);
    setPhase({ at: 'sending', preview: url, file });
    try {
      const [{ blob, filename }, thumb] = await Promise.all([shrinkPhoto(file), thumbnail(file)]);
      const result = await sendPhoto(blob, filename, null);
      setChoice(preselect(result.machine));
      setCount(1);
      setOwned(true);
      setPhase({ at: 'confirm', preview: url, thumb, result });
    } catch (e) {
      const why = e instanceof KisanError && e.status !== 0 ? e.message : say('network', language);
      setPhase({ at: 'failed', preview: url, file, why });
    }
  }

  function picked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // so the same photo can be chosen again
    if (file) void send(file);
  }

  function add() {
    if (phase.at !== 'confirm' || !choice) return;
    const guess = phase.result.machine;
    const machine: OwnedMachine = {
      id: newId(),
      type: choice,
      count,
      owned,
      ...(phase.thumb ? { thumb: phase.thumb } : {}),
      guess: { machine: guess?.machine ?? null, confidence: guess?.confidence ?? null },
      addedAt: new Date().toISOString(),
    };
    farmStore.set((f) => ({ ...f, machines: [...f.machines, machine] }));
    setPhase({ at: 'idle' });
  }

  function remove(id: string) {
    farmStore.set((f) => ({ ...f, machines: f.machines.filter((m) => m.id !== id) }));
  }

  const busy = phase.at === 'sending';
  const note = phase.at === 'confirm' ? describeGuess(phase.result.machine) : null;

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      <Card padding="md">
        <h2 style={{ margin: 0, fontSize: '1.15rem', color: '#0f172a' }}>🚜 {say('machinesTitle', language)}</h2>
        <p style={{ margin: '0.35rem 0 1rem', fontSize: '1rem', lineHeight: 1.5, color: '#334155' }}>{say('machinesIntro', language)}</p>

        <input ref={camera} type="file" accept="image/*" capture="environment" onChange={picked} hidden />
        <input ref={gallery} type="file" accept="image/*" onChange={picked} hidden />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 11rem), 1fr))', gap: '0.5rem' }}>
          <Button size="lg" disabled={busy} onClick={() => camera.current?.click()} style={BIG}>
            📷 {say('takePhoto', language)}
          </Button>
          <Button size="lg" variant="secondary" disabled={busy} onClick={() => gallery.current?.click()} style={BIG}>
            🖼️ {say('fromGallery', language)}
          </Button>
        </div>
        <p style={{ margin: '0.6rem 0 0', fontSize: '0.85rem', color: '#64748b' }}>{say('photoPrivacy', language)}</p>
      </Card>

      {phase.at !== 'idle' && (
        <Card padding="md" style={{ borderColor: phase.at === 'confirm' ? GREEN : undefined }}>
          <div style={{ display: 'grid', gap: '0.9rem' }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- a local blob: preview, not a served image */}
            <img
              src={phase.preview}
              alt=""
              style={{ width: '100%', maxHeight: '14rem', objectFit: 'cover', borderRadius: '0.5rem', background: '#f1f5f9', opacity: busy ? 0.6 : 1 }}
            />

            {busy && (
              <p role="status" style={{ margin: 0, color: '#475569' }}>
                {say('sendingPhoto', language)}
              </p>
            )}

            {phase.at === 'failed' && (
              <>
                <Alert variant="danger">{sayWith('photoFailed', language, { why: phase.why })}</Alert>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="lg" onClick={() => void send(phase.file, phase.preview)} style={BIG}>
                    {say('tryAgain', language)}
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => setPhase({ at: 'idle' })} style={BIG}>
                    {say('cancel', language)}
                  </Button>
                </div>
              </>
            )}

            {phase.at === 'confirm' && note && (
              <>
                <div role="status">
                  {note.kind === 'looksLike' ? (
                    <>
                      <div style={{ fontSize: '1.15rem', fontWeight: 700, color: '#0f172a' }}>
                        {sayWith('looksLike', language, { machine: machineLabel(note.machine, language) })}
                      </div>
                      <div style={{ fontSize: '0.95rem', color: '#475569' }}>
                        {sayWith('sure', language, { pct: note.pct })} · {say('tapToCorrect', language)}
                      </div>
                    </>
                  ) : (
                    <div style={{ fontSize: '1.05rem', fontWeight: 600, color: '#0f172a' }}>{say(note.kind, language)}</div>
                  )}
                </div>

                <fieldset style={{ border: 'none', margin: 0, padding: 0, minWidth: 0 }}>
                  <legend style={{ fontSize: '0.95rem', color: '#334155', marginBottom: '0.4rem', padding: 0 }}>
                    {say('whichMachine', language)}
                  </legend>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {CHOICES.map((c) => (
                      <Button
                        key={c}
                        type="button"
                        variant={choice === c ? 'primary' : 'outline'}
                        aria-pressed={choice === c}
                        onClick={() => setChoice(c)}
                        style={BIG}
                      >
                        {machineLabel(c, language)}
                      </Button>
                    ))}
                  </div>
                </fieldset>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.95rem', color: '#334155' }}>{say('howMany', language)}</span>
                    <Button variant="secondary" aria-label={say('fewer', language)} disabled={count <= 1} onClick={() => setCount((n) => Math.max(1, n - 1))} style={{ ...BIG, minWidth: '3rem' }}>
                      −
                    </Button>
                    <span aria-live="polite" style={{ minWidth: '1.5rem', textAlign: 'center', fontSize: '1.15rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                      {count}
                    </span>
                    <Button variant="secondary" aria-label={say('more', language)} disabled={count >= 20} onClick={() => setCount((n) => Math.min(20, n + 1))} style={{ ...BIG, minWidth: '3rem' }}>
                      +
                    </Button>
                  </div>
                  <div role="group" style={{ display: 'flex', gap: '0.5rem' }}>
                    <Button variant={owned ? 'primary' : 'outline'} aria-pressed={owned} onClick={() => setOwned(true)} style={BIG}>
                      {say('mine', language)}
                    </Button>
                    <Button variant={!owned ? 'primary' : 'outline'} aria-pressed={!owned} onClick={() => setOwned(false)} style={BIG}>
                      {say('rented', language)}
                    </Button>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Button size="lg" disabled={!choice} onClick={add} style={BIG}>
                    ✓ {say('addMachine', language)}
                  </Button>
                  <Button size="lg" variant="ghost" onClick={() => setPhase({ at: 'idle' })} style={BIG}>
                    {say('cancel', language)}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      )}

      <section aria-label={say('machinesTitle', language)}>
        {farm.machines.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>{say('noMachinesYet', language)}</p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.5rem' }}>
            {farm.machines.map((m) => (
              <li key={m.id}>
                <Card padding="sm">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {m.thumb ? (
                      // eslint-disable-next-line @next/next/no-img-element -- a data: thumbnail kept on the phone
                      <img src={m.thumb} alt="" width={56} height={56} style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: '0.5rem', flex: 'none' }} />
                    ) : (
                      <span aria-hidden="true" style={{ width: 56, height: 56, display: 'grid', placeItems: 'center', fontSize: '1.6rem', background: '#f1f5f9', borderRadius: '0.5rem', flex: 'none' }}>
                        🚜
                      </span>
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 700, color: '#0f172a', overflowWrap: 'anywhere' }}>
                        {m.count} × {machineLabel(m.type, language)}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#475569' }}>{say(m.owned ? 'mine' : 'rented', language)}</div>
                    </div>
                    <Button variant="ghost" onClick={() => remove(m.id)} style={{ minHeight: '2.75rem' }}>
                      {say('remove', language)}
                    </Button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}
        {farm.machines.length > 0 && (
          <p style={{ margin: '0.75rem 0 0', fontSize: '0.9rem', color: '#64748b' }}>{say('checkNext', language)}</p>
        )}
      </section>
    </div>
  );
}
