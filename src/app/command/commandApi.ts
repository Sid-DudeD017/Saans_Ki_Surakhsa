// Saans Command's reads and writes for the console (P4), in p4-command.openapi.yaml's shapes. With
// NEXT_PUBLIC_USE_MOCKS on (the default) they run on the example cases in mockCases.ts, through the same
// rules the real API uses (but no sign-in: every example is shown); off, they call /v1/cases as the chosen
// demo officer, and Cedar on the server decides what that officer sees.
import officers from '../../../infra/config/officers.local.json';
import type { components } from '../../../packages/contracts/types';
import { nextStatus, type CaseAction } from '../../../services/command-api/caseRules';
import { MOCK_CASES } from './mockCases';

export type CaseSummary = components['schemas']['CaseSummary'];
export type CaseDetail = components['schemas']['CaseDetail'];
export type CommandCase = components['schemas']['CommandCase'];
export type CaseStatus = CommandCase['status'];
export type { CaseAction };

export const USE_MOCKS = process.env.NEXT_PUBLIC_USE_MOCKS !== 'false';
const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');

/** The local stack's demo officers (non-production; Cognito replaces them at G7). */
export const OFFICERS = officers.officers.map(({ token, name, district }) => ({ token, name, district }));
export const DEFAULT_OFFICER = OFFICERS[0].token;

export class ApiError extends Error {
  constructor(readonly status: number, readonly code: string, message: string) {
    super(message);
  }
}

async function call<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...init?.headers, Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, body?.error?.code ?? 'error', body?.error?.message ?? res.statusText);
  return body as T;
}

// ---- mock mode: a copy of the examples that actions change, as the database would ----

const mock: CaseDetail[] = structuredClone(MOCK_CASES);
const toSummary = (d: CaseDetail): CaseSummary => ({
  case: d.case,
  type: d.type!,
  district: d.report.district,
  location: d.report.location,
  deadline: d.deadline!,
  hasHelpRequest: !!d.helpRequest,
  penalty: d.penalty,
  authorities: d.authorities,
  reports: d.reports,
  ...(d.escalatedAt ? { escalatedAt: d.escalatedAt, escalatedTo: d.escalatedTo } : {}),
});

export interface Filters {
  status?: CaseStatus;
  district?: string;
}

export async function listCases(f: Filters = {}, token = DEFAULT_OFFICER): Promise<CaseSummary[]> {
  if (USE_MOCKS) {
    return mock
      .filter((d) => (!f.status || d.case.status === f.status) && (!f.district || d.report.district === f.district))
      .map(toSummary)
      .sort((a, b) => a.deadline.localeCompare(b.deadline));
  }
  const q = new URLSearchParams({ limit: '100', ...(f.status ? { status: f.status } : {}), ...(f.district ? { district: f.district } : {}) });
  return (await call<{ cases: CaseSummary[] }>(`/v1/cases?${q}`, token)).cases;
}

export async function getCase(id: string, token = DEFAULT_OFFICER): Promise<CaseDetail> {
  if (USE_MOCKS) {
    const d = mock.find((x) => x.case.id === id);
    if (!d) throw new ApiError(404, 'not_found', `no case ${id}`);
    return structuredClone(d);
  }
  return call(`/v1/cases/${encodeURIComponent(id)}`, token);
}

export interface ActionInput {
  action: CaseAction;
  reason: string;
  previousCaseVersion: number;
  selectedMachineId?: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
function indiaNow() {
  const d = new Date(Date.now() + 5.5 * 3_600_000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}+05:30`;
}

export async function actOnCase(id: string, input: ActionInput, token = DEFAULT_OFFICER): Promise<CommandCase> {
  if (USE_MOCKS) {
    const d = mock.find((x) => x.case.id === id);
    if (!d) throw new ApiError(404, 'not_found', `no case ${id}`);
    if (d.case.status === 'CLOSED') throw new ApiError(409, 'conflict', `case ${id} is closed`);
    if (d.case.version !== input.previousCaseVersion) {
      throw new ApiError(409, 'version_conflict', `the case is at version ${d.case.version}; reload it and decide again`);
    }
    const now = indiaNow();
    d.decisions.push({ id: `decision-${d.decisions.length + 1}`, caseId: id, officerId: 'officer-demo', createdAt: now, ...input });
    d.case = { ...d.case, status: nextStatus(input.action, d.case.status), version: d.case.version + 1, updatedAt: now };
    if ((input.action === 'APPROVE' || input.action === 'CHANGE') && d.helpRequest?.status === 'OPEN') d.helpRequest = { ...d.helpRequest, status: 'MATCHED' };
    if (input.action === 'CLOSE') d.report = { ...d.report, status: 'CLOSED' };
    return structuredClone(d.case);
  }
  return call(`/v1/cases/${encodeURIComponent(id)}/actions`, token, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
}
