"use client";

import { useCallback, useEffect, useState } from "react";
import { Alert, Badge, Card, Container } from "../../components/ui";
import {
  beginCognitoLogin,
  isCognitoAuthenticated,
  signOut,
} from "../../lib/cognitoAuth";
import { CaseMap } from "./CaseMap";
import {
  ApiError,
  getCase,
  getOfficerIdentity,
  listCases,
  type CaseDetail,
  type CaseStatus,
  type CaseSummary,
  type OfficerIdentity,
} from "./commandApi";
import { LiveCaseDetailPanel } from "./LiveCaseDetailPanel";

const STATUSES: Array<[CaseStatus | "", string]> = [
  ["OPEN", "Open"],
  ["ACTION_APPROVED", "Help approved"],
  ["ACTION_CHANGED", "Changed"],
  ["CLOSED", "Closed"],
  ["", "All"],
];
const DISTRICTS = ["", "Sangrur", "Patiala", "unassigned"];

function messageFor(cause: unknown): string {
  if (cause instanceof ApiError && cause.status === 401)
    return "Your officer session expired. Sign in again.";
  if (cause instanceof ApiError && cause.status === 403)
    return "This account is not assigned to the required officer and district groups.";
  return cause instanceof Error
    ? cause.message
    : "The Command API could not be reached.";
}

export function LiveCommandPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [identity, setIdentity] = useState<OfficerIdentity | null>(null);
  const [status, setStatus] = useState<CaseStatus | "">("OPEN");
  const [district, setDistrict] = useState("");
  const [queue, setQueue] = useState<{ cases?: CaseSummary[]; error?: string }>(
    {},
  );
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ case?: CaseDetail; error?: string }>(
    {},
  );
  const [reloads, setReloads] = useState(0);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (active) setAuthenticated(isCognitoAuthenticated());
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!authenticated) return;
    let active = true;
    getOfficerIdentity().then(
      (value) => {
        if (active) setIdentity(value);
      },
      (cause) => {
        if (active) setQueue({ error: messageFor(cause) });
      },
    );
    return () => {
      active = false;
    };
  }, [authenticated]);

  useEffect(() => {
    if (!authenticated || !identity) return;
    let active = true;
    listCases({
      status: status || undefined,
      district: district || undefined,
    }).then(
      (cases) => {
        if (active) setQueue({ cases });
      },
      (cause) => {
        if (active) setQueue({ error: messageFor(cause) });
      },
    );
    return () => {
      active = false;
    };
  }, [authenticated, identity, status, district, reloads]);

  useEffect(() => {
    if (!authenticated || !selected) return;
    let active = true;
    getCase(selected).then(
      (value) => {
        if (active) setDetail({ case: value });
      },
      (cause) => {
        if (active) setDetail({ error: messageFor(cause) });
      },
    );
    return () => {
      active = false;
    };
  }, [authenticated, selected, reloads]);

  const reload = useCallback(() => setReloads((value) => value + 1), []);
  const cases = queue.cases ?? [];
  const shown =
    selected && detail.case?.case.id === selected ? detail.case : null;

  return (
    <Container
      maxWidth="lg"
      style={{ paddingTop: "2rem", paddingBottom: "3rem" }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "start",
          gap: "1rem",
          flexWrap: "wrap",
          marginBottom: "1.25rem",
        }}
      >
        <div>
          <Badge variant="danger" size="md">
            P4 MODULE
          </Badge>
          <h1 style={{ marginBottom: "0.25rem" }}>🛡️ Command Console</h1>
          <p style={{ margin: 0, color: "#475569" }}>
            Secure officer access to assigned cases and decisions.
          </p>
        </div>
        {authenticated && (
          <button
            type="button"
            onClick={signOut}
            style={{ minHeight: "44px", padding: "0.5rem 1rem" }}
          >
            Sign out
          </button>
        )}
      </div>

      {!authenticated ? (
        <Card padding="lg">
          <h2>Officer authentication required</h2>
          <p>
            Sign in with the Cognito officer account issued by your
            administrator.
          </p>
          <button
            type="button"
            onClick={() => void beginCognitoLogin()}
            style={{
              minHeight: "44px",
              padding: "0.65rem 1rem",
              fontWeight: 700,
            }}
          >
            Sign in as officer
          </button>
        </Card>
      ) : (
        <>
          {identity && (
            <div style={{ marginBottom: "1rem" }}>
              <Alert variant="success" title="Authenticated officer">
                Role: {identity.role} · District: {identity.district}
              </Alert>
            </div>
          )}
          {queue.error && (
            <div style={{ marginBottom: "1rem" }}>
              <Alert variant="danger" title="Command API unavailable">
                {queue.error}
              </Alert>
            </div>
          )}
          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(min(100%, 22rem), 1fr))",
              gap: "1rem",
              alignItems: "start",
            }}
          >
            <div style={{ display: "grid", gap: "1rem" }}>
              <Card padding="md">
                <div
                  style={{
                    display: "flex",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                    marginBottom: "0.75rem",
                  }}
                >
                  <label>
                    Status{" "}
                    <select
                      value={status}
                      onChange={(event) =>
                        setStatus(event.target.value as CaseStatus | "")
                      }
                    >
                      {STATUSES.map(([value, name]) => (
                        <option key={value} value={value}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    District{" "}
                    <select
                      value={district}
                      onChange={(event) => setDistrict(event.target.value)}
                    >
                      {DISTRICTS.map((value) => (
                        <option key={value} value={value}>
                          {value || "All"}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {queue.cases && cases.length === 0 && <p>No cases match.</p>}
                <ul
                  style={{
                    listStyle: "none",
                    padding: 0,
                    display: "grid",
                    gap: "0.5rem",
                  }}
                >
                  {cases.map((summary) => (
                    <li key={summary.case.id}>
                      <button
                        type="button"
                        onClick={() => setSelected(summary.case.id)}
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          textAlign: "left",
                          minHeight: "44px",
                        }}
                      >
                        <strong>
                          {summary.type?.replaceAll("_", " ")} ·{" "}
                          {summary.district}
                        </strong>
                        <br />
                        <span>
                          {summary.case.status.replaceAll("_", " ")} ·{" "}
                          {summary.hasHelpRequest
                            ? "Farmer needs help"
                            : summary.case.evidenceSummary}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Card>
              {cases.length > 0 && (
                <CaseMap
                  title="Cases on the map"
                  onPick={setSelected}
                  points={cases.map((summary) => ({
                    id: summary.case.id,
                    label: `${summary.type} · ${summary.district}`,
                    kind:
                      summary.case.status === "CLOSED"
                        ? "closed"
                        : summary.hasHelpRequest
                          ? "help"
                          : "report",
                    selected: summary.case.id === selected,
                    ...summary.location,
                  }))}
                />
              )}
            </div>
            <div>
              {shown ? (
                <LiveCaseDetailPanel detail={shown} onChanged={reload} />
              ) : (
                <Card padding="lg">
                  <p>Select a case from the queue or map.</p>
                </Card>
              )}
            </div>
          </div>
        </>
      )}
    </Container>
  );
}
