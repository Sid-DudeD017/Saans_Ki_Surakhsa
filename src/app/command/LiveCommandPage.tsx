"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowRightLeft, ClipboardList, FolderOpen, LogIn, MapPinned, ShieldCheck } from "lucide-react";
import { Alert } from "../../components/ui";
import { getAqi, type AqiData } from "../../lib/api";
import { beginCognitoLogin, isCognitoAuthenticated, signOut } from "../../lib/cognitoAuth";
import { CaseMap } from "./CaseMap";
import {
  ApiError, getCase, getOfficerIdentity, listCases,
  type CaseDetail, type CaseStatus, type CaseSummary, type OfficerIdentity,
} from "./commandApi";
import { LiveCaseDetailPanel } from "./LiveCaseDetailPanel";
import styles from "./liveCommand.module.css";

type View = "cases" | "map" | "case";
const STATUSES: Array<[CaseStatus | "", string]> = [
  ["", "All cases"], ["OPEN", "Open"], ["ACTION_APPROVED", "Help approved"],
  ["ACTION_CHANGED", "Changed"], ["CLOSED", "Closed"],
];

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 401) return "Your officer session expired. Sign in again.";
  if (cause instanceof ApiError && cause.status === 403) return "This officer account is not assigned to the required role or district.";
  return cause instanceof Error ? cause.message : "The Command API could not be reached.";
}

function formatDate(value?: string) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata",
  }).format(new Date(value));
}

function readable(value?: string) {
  return value ? value.replaceAll("_", " ").toLowerCase() : "incident";
}

export function LiveCommandPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<OfficerIdentity | null>(null);
  const [status, setStatus] = useState<CaseStatus | "">("");
  const [queue, setQueue] = useState<{ cases?: CaseSummary[]; error?: string }>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ case?: CaseDetail; error?: string }>({});
  const [view, setView] = useState<View>("cases");
  const [reloads, setReloads] = useState(0);
  const [aqi, setAqi] = useState<AqiData | null>(null);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => active && setAuthenticated(isCognitoAuthenticated()));
    getAqi(28.73, 77.12).then((value) => active && setAqi(value), () => undefined);
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    getOfficerIdentity().then(
      (value) => active && setIdentity(value),
      (cause) => active && setQueue({ error: messageFor(cause) }),
    );
    return () => { active = false; };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !identity) return;
    let active = true;
    listCases({ status: status || undefined }).then(
      (cases) => active && setQueue({ cases }),
      (cause) => active && setQueue({ error: messageFor(cause) }),
    );
    return () => { active = false; };
  }, [authenticated, identity, status, reloads]);

  useEffect(() => {
    if (!authenticated || !selected) return;
    let active = true;
    getCase(selected).then(
      (value) => active && setDetail({ case: value }),
      (cause) => active && setDetail({ error: messageFor(cause) }),
    );
    return () => { active = false; };
  }, [authenticated, selected, reloads]);

  const reload = useCallback(() => setReloads((value) => value + 1), []);
  const cases = useMemo(() => queue.cases ?? [], [queue.cases]);
  const shown = selected && detail.case?.case.id === selected ? detail.case : null;
  const points = useMemo(() => cases.map((summary) => ({
    id: summary.case.id,
    label: `${readable(summary.type)} · ${summary.district}`,
    kind: summary.case.status === "CLOSED" ? ("closed" as const) : summary.hasHelpRequest ? ("help" as const) : ("report" as const),
    selected: summary.case.id === selected,
    ...summary.location,
  })), [cases, selected]);

  function openCase(id: string) {
    setDetail({});
    setSelected(id);
    setView("case");
  }

  return (
    <section className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          <div>
            <div className={styles.wordmark}><span aria-hidden="true">🌱</span> Saans</div>
            <h1>Saans Command</h1>
            <p>Cases for district officers</p>
          </div>
          {identity && (
            <div className={styles.officer} title={`${identity.role} · ${identity.district}`}>
              <ShieldCheck aria-hidden="true" size={20} />
              <span><strong>{identity.role}</strong><small>{identity.district}</small></span>
            </div>
          )}
        </header>

        <div className={styles.airCard} aria-label="Current air quality">
          <span className={styles.airDot} />
          <span className={styles.airLabel}>Air now</span>
          <strong>AQI {aqi?.aqi ?? "—"}</strong>
          <b>{aqi?.category || "Live regional air"}</b>
          <small>📍 {aqi?.station_name || "Regional monitoring station"} · {aqi?.dominant_pollutant || "PM2.5"}</small>
        </div>

        {!authenticated ? (
          <main className={styles.authStage}>
            <div className={styles.authCard}>
              <span className={styles.authIcon}><ShieldCheck aria-hidden="true" /></span>
              <p className={styles.eyebrow}>SECURE OFFICER ACCESS</p>
              <h2>Sign in to open Command</h2>
              <p>Your assigned cases, live incident map, and decisions are protected by AWS Cognito.</p>
              <button type="button" className={styles.primaryButton} onClick={() => void beginCognitoLogin()}>
                <LogIn aria-hidden="true" size={19} /> Sign in as officer
              </button>
            </div>
          </main>
        ) : (
          <main className={styles.workspace}>
            <div className={styles.sectionHeading}>
              <div><h2>Reports and farmers&apos; help requests.</h2><p>{cases.length} assigned {cases.length === 1 ? "case" : "cases"}</p></div>
              <label className={styles.filter}>
                <span>Status</span>
                <select value={status} onChange={(event) => setStatus(event.target.value as CaseStatus | "")}>
                  {STATUSES.map(([value, name]) => <option key={value} value={value}>{name}</option>)}
                </select>
              </label>
            </div>

            {queue.error && <Alert variant="danger" title="Command API unavailable">{queue.error}</Alert>}

            {view === "cases" && (
              <div className={styles.caseList}>
                {!queue.cases && !queue.error && <div className={styles.loadingCard}>Loading assigned cases…</div>}
                {queue.cases && cases.length === 0 && <div className={styles.loadingCard}>No cases match this filter.</div>}
                {cases.map((summary) => (
                  <button key={summary.case.id} type="button" className={styles.caseCard} onClick={() => openCase(summary.case.id)}>
                    <div className={styles.caseMeta}><span className={styles.statusBadge}>{readable(summary.case.status)}</span><span>{summary.case.id}</span></div>
                    <div className={styles.caseMain}>
                      <span><strong>{readable(summary.type)} · {summary.district}</strong><small>{summary.hasHelpRequest ? "Farmer needs machinery support" : summary.case.evidenceSummary}</small></span>
                      <b>SLA: {formatDate(summary.deadline)}</b>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {view === "map" && <div className={styles.mapStage}>{points.length ? <CaseMap title="Assigned cases on the map" points={points} onPick={openCase} /> : <div className={styles.loadingCard}>No mapped cases are available.</div>}</div>}

            {view === "case" && (
              <div className={styles.detailStage}>
                {!selected && <div className={styles.loadingCard}>Choose a report from Cases or Map.</div>}
                {selected && !shown && !detail.error && <div className={styles.loadingCard}>Opening case…</div>}
                {detail.error && <Alert variant="danger" title="Could not open this case">{detail.error}</Alert>}
                {shown && <LiveCaseDetailPanel detail={shown} onChanged={reload} />}
              </div>
            )}
          </main>
        )}
      </div>

      {authenticated && (
        <nav className={styles.bottomDock} aria-label="Command views">
          <button type="button" className={view === "cases" ? styles.activeTab : ""} onClick={() => setView("cases")}><ClipboardList aria-hidden="true" /><span>Cases</span></button>
          <button type="button" className={view === "map" ? styles.activeTab : ""} onClick={() => setView("map")}><MapPinned aria-hidden="true" /><span>Map</span></button>
          <button type="button" className={view === "case" ? styles.activeTab : ""} onClick={() => setView("case")}><FolderOpen aria-hidden="true" /><span>Case</span></button>
          <button type="button" className={styles.switchButton} onClick={signOut} title="Sign out and switch officer"><ArrowRightLeft aria-hidden="true" /><span>Switch</span></button>
        </nav>
      )}
    </section>
  );
}
