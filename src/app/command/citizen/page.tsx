'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Container, Card, Button, Alert } from '../../../components/ui';
import { useLanguage } from '../../../lib/i18n';

export default function CitizenSubmitPage() {
  const { t } = useLanguage();
  const router = useRouter();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    name: '',
    contact: '',
    district: 'Sangrur',
    type: 'garbage',
    desc: '',
    consent: false,
    emergency: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.consent) {
      setError("You must consent to submit the report.");
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/v1/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: form.type,
          district: form.district,
          reporter_identity: form.name + ' (' + form.contact + ')',
          reporter_consent: form.consent,
          idempotency_key: `cit-${Date.now()}`
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to submit report');
      
      localStorage.setItem('saans_citizen_auth', form.name + ' (' + form.contact + ')');
      
      const ticketId = data.id;
      if (!ticketId) throw new Error('Invalid response from server: no ticket ID');
      router.push(`/command/citizen/${ticketId}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '0.6rem', borderRadius: '0.4rem', border: '1px solid #cbd5e1', marginBottom: '1rem',
    fontSize: '1rem', boxSizing: 'border-box'
  };

  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
        {t.commandCitizen.emergencyBanner}
      </div>
      
      <div style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        {t.commandCitizen.devBanner}
      </div>

      <h1 style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>{t.commandCitizen.title}</h1>
      <p style={{ color: '#475569', marginBottom: '1.5rem' }}>{t.commandCitizen.subtitle}</p>

      {error && <div style={{ marginBottom: '1rem' }}><Alert variant="danger" title="Error">{error}</Alert></div>}

      <Card padding="lg">
        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '0.5rem' }}>
          
          <label style={{ fontWeight: '500' }}>{t.commandCitizen.name}</label>
          <input style={inputStyle} value={form.name} onChange={e => setForm({...form, name: e.target.value})} required />

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.contact}</label>
          <input style={inputStyle} type="text" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} required />

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.location}</label>
          <select style={inputStyle} value={form.district} onChange={e => setForm({...form, district: e.target.value})}>
            <option value="Sangrur">Sangrur</option>
            <option value="Patiala">Patiala</option>
          </select>

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.category}</label>
          <select style={inputStyle} value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
            <option value="farm_fire">Farm Fire</option>
            <option value="garbage">Garbage</option>
            <option value="vehicle">Vehicle Emissions</option>
            <option value="firecrackers">Firecrackers</option>
          </select>

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.desc}</label>
          <textarea style={{...inputStyle, minHeight: '100px'}} value={form.desc} onChange={e => setForm({...form, desc: e.target.value})} required />

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.dateTime}</label>
          <input style={inputStyle} type="datetime-local" required />

          <label style={{ fontWeight: '500' }}>{t.commandCitizen.attachments}</label>
          <input style={{...inputStyle, border: 'none', padding: 0}} type="file" multiple />

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: '#b91c1c', fontWeight: 'bold' }}>
            <input type="checkbox" checked={form.emergency} onChange={e => setForm({...form, emergency: e.target.checked})} />
            {t.commandCitizen.emergencyToggle}
          </label>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', fontSize: '0.9rem' }}>
            <input type="checkbox" checked={form.consent} onChange={e => setForm({...form, consent: e.target.checked})} />
            {t.commandCitizen.consentText}
          </label>

          <Button variant="primary" type="submit" size="lg" disabled={loading} style={{ width: '100%', minHeight: '44px' }}>
            {loading ? 'Submitting...' : t.commandCitizen.submit}
          </Button>

        </form>
      </Card>
    </Container>
  );
}
