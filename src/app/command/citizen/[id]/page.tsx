'use client';

import React, { useEffect, useState, use } from 'react';
import { Container, Card, Button, Badge, Alert } from '../../../../components/ui';
import { useLanguage } from '../../../../lib/i18n';

export default function CitizenTicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useLanguage();
  
  const [ticket, setTicket] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTicket = async () => {
    try {
      const auth = localStorage.getItem('saans_citizen_auth') || 'anonymous';
      const res = await fetch(`/v1/tickets/${id}`, {
        headers: { 'x-user-id': auth }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || 'Failed to load ticket');
      setTicket(data.ticket);
      
      const resHist = await fetch(`/v1/tickets/${id}/history`, {
        headers: { 'x-user-id': auth }
      });
      const dataHist = await resHist.json();
      if (resHist.ok && dataHist.history) {
         setHistory(dataHist.history);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTicket();
  }, [id]);

  const handleAction = async (action: 'citizen_confirm' | 'citizen_reopen') => {
    try {
      const auth = localStorage.getItem('saans_citizen_auth') || 'anonymous';
      const body: any = { action };
      if (action === 'citizen_reopen') {
         body.reason = prompt('Please provide a reason for reopening:');
         if (!body.reason) return;
      }
      
      const res = await fetch(`/v1/tickets/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-user-id': auth },
        body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error?.message || `Failed to ${action}`);
      }
      await fetchTicket();
    } catch (err: any) {
      alert(err.message);
    }
  };

  if (loading) return <Container maxWidth="md" style={{ paddingTop: '2rem' }}><p>Loading...</p></Container>;
  if (error) return <Container maxWidth="md" style={{ paddingTop: '2rem' }}><Alert variant="danger" title="Error">{error}</Alert></Container>;
  if (!ticket) return null;

  return (
    <Container maxWidth="md" style={{ paddingTop: '2rem', paddingBottom: '3rem' }}>
      <div style={{ backgroundColor: '#fee2e2', color: '#b91c1c', padding: '0.75rem', borderRadius: '0.5rem', marginBottom: '1.5rem', fontWeight: 'bold', textAlign: 'center' }}>
        {t.commandCitizen.emergencyBanner}
      </div>
      
      <div style={{ backgroundColor: '#fef08a', color: '#854d0e', padding: '0.5rem', borderRadius: '0.5rem', marginBottom: '1.5rem', textAlign: 'center', fontSize: '0.875rem' }}>
        {t.commandCitizen.devBanner}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 style={{ fontSize: '1.75rem', margin: 0 }}>{t.commandCitizen.ticketTitle}</h1>
        <Badge variant={ticket.status === 'closed' ? 'success' : 'primary'} size="md">{ticket.status}</Badge>
      </div>

      <Card padding="lg" style={{ marginBottom: '1rem' }}>
        <p style={{ margin: '0 0 0.5rem 0', color: '#475569' }}><strong>ID:</strong> {ticket.id}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: '#475569' }}><strong>{t.commandCitizen.category}:</strong> {ticket.type}</p>
        <p style={{ margin: '0 0 0.5rem 0', color: '#475569' }}><strong>{t.commandCitizen.location}:</strong> {ticket.district}</p>
        
        {ticket.resolution_summary && (
           <div style={{ marginTop: '1rem', padding: '1rem', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '0.5rem' }}>
             <h3 style={{ margin: '0 0 0.5rem 0', color: '#166534' }}>{t.commandCitizen.resolution}</h3>
             <p style={{ margin: 0, color: '#15803d' }}>{ticket.resolution_summary}</p>
           </div>
        )}

        {ticket.status === 'resolved' && (
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <Button variant="primary" onClick={() => handleAction('citizen_confirm')}>{t.commandCitizen.confirmBtn}</Button>
            <Button variant="secondary" onClick={() => handleAction('citizen_reopen')}>{t.commandCitizen.reopenBtn}</Button>
          </div>
        )}
      </Card>

      <h2 style={{ fontSize: '1.25rem', marginTop: '2rem', marginBottom: '1rem' }}>{t.commandCitizen.timeline}</h2>
      <Card padding="md">
        {history.length === 0 ? (
          <p style={{ margin: 0, color: '#64748b' }}>No timeline events yet.</p>
        ) : (
          <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {history.map((h, i) => (
              <li key={i} style={{ display: 'flex', gap: '1rem' }}>
                <div style={{ color: '#94a3b8', fontSize: '0.85rem', width: '120px', flexShrink: 0 }}>
                  {new Date(h.created_at).toLocaleString()}
                </div>
                <div>
                  <div style={{ fontWeight: '500' }}>{h.action}</div>
                  {h.reason && <div style={{ color: '#475569', fontSize: '0.9rem' }}>{h.reason}</div>}
                  <div style={{ color: '#64748b', fontSize: '0.8rem' }}>by {h.actor === localStorage.getItem('saans_citizen_auth') ? 'You' : (h.role || h.actor)}</div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </Container>
  );
}
