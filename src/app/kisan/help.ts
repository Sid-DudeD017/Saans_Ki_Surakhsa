// The Help tab's plain logic: which district the farm is in, which numbers to show for it
// (infra/config/helplines.json, K23), and the farmer's tickets kept on the phone (K21).
import districtsConfig from '../../../infra/config/districts.json';
import helplinesConfig from '../../../infra/config/helplines.json';
import seed from '../../../data/seed/chc_demo.json';
import { localStore } from '../../lib/localStore';
import type { FarmProfile } from './farmProfile';
import type { Language } from './kisanApi';

export interface Helpline {
  id: string;
  number: string;
  emergency: boolean;
  names: Record<Language, string>;
  when: Record<Language, string>;
  source: string;
}

export interface HelplineSource {
  title: string;
  publisher: string;
  url: string;
  checked_on: string;
}

export const HELPLINES = helplinesConfig as unknown as {
  sources: Record<string, HelplineSource>;
  everywhere: Helpline[];
  districts: Record<string, Helpline[]>;
};

/** Emergency first, then the district's own offices, then the national farming line. */
export function helplinesFor(district: string | null): Helpline[] {
  const own = (district && HELPLINES.districts[district]) || [];
  const all = [...HELPLINES.everywhere, ...own];
  return [...all.filter((h) => h.emergency), ...own.filter((h) => !h.emergency), ...HELPLINES.everywhere.filter((h) => !h.emergency)];
}

type Ring = [number, number][]; // [lon, lat]

function inside(point: { lat: number; lon: number }, ring: Ring): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > point.lat !== yj > point.lat && point.lon < ((xj - xi) * (point.lat - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** The demo district whose outline covers the point (the same outlines Command's triage uses), or null. */
export function districtAt(point: { lat: number; lon: number }): string | null {
  const districts = (districtsConfig as unknown as { districts: { name: string; boundary: Ring }[] }).districts;
  return districts.find((d) => inside(point, d.boundary))?.name ?? null;
}

const VILLAGES = (seed as unknown as { villages: { name: string; district: string; lat: number; lon: number }[] }).villages;

/** Where the farm is, as a point: its GPS, or a known village's centre. Null if neither. */
export function farmPoint(farm: FarmProfile): { lat: number; lon: number } | null {
  const loc = farm.location;
  if (loc?.lat !== undefined && loc.lon !== undefined) return { lat: loc.lat, lon: loc.lon };
  const village = loc?.village && VILLAGES.find((v) => v.name.toLowerCase() === loc.village!.trim().toLowerCase());
  return village ? { lat: village.lat, lon: village.lon } : null;
}

export function farmDistrict(farm: FarmProfile): string | null {
  const point = farmPoint(farm);
  return point ? districtAt(point) : null;
}

export const GRIEVANCE_SUBTYPES = ['chc_no_show', 'chc_overcharge', 'machine_broken', 'subsidy_delay', 'officer_conduct', 'other'] as const;
export type GrievanceSubtype = (typeof GRIEVANCE_SUBTYPES)[number];

/** Complaints about a CHC ask which one. */
export const ABOUT_A_CHC: GrievanceSubtype[] = ['chc_no_show', 'chc_overcharge', 'machine_broken'];

export interface Ticket {
  id: string;
  subtype: GrievanceSubtype;
  sentAt: string;
}

function cleanTickets(saved: unknown): { tickets: Ticket[] } {
  const list = (saved as { tickets?: unknown })?.tickets;
  return {
    tickets: Array.isArray(list)
      ? list.filter(
          (t): t is Ticket =>
            !!t && typeof t.id === 'string' && typeof t.sentAt === 'string' && (GRIEVANCE_SUBTYPES as readonly string[]).includes(t.subtype),
        )
      : [],
  };
}

/** The farmer's complaints, newest first, kept on the phone so "My tickets" survives a reload. */
export const ticketStore = localStore<{ tickets: Ticket[] }>('saans_kisan_tickets', { tickets: [] }, cleanTickets);

export function addTicket(ticket: Ticket) {
  ticketStore.set((s) => ({ tickets: [ticket, ...s.tickets.filter((t) => t.id !== ticket.id)] }));
}

/** The status page's stages, in order; "merged" sits with "case opened". */
export const TICKET_STEPS = ['received', 'sent_to_officer', 'case_opened', 'acted_on', 'closed'] as const;

export function stepOf(status: string): number {
  const i = (TICKET_STEPS as readonly string[]).indexOf(status === 'merged' ? 'case_opened' : status);
  return i < 0 ? 0 : i;
}
