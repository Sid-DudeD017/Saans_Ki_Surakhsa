"use client";

import { useState } from "react";
import { Alert, Badge, Button, Card } from "../../components/ui";
import {
  ApiError,
  actOnCase,
  type CaseAction,
  type CaseDetail,
} from "./commandApi";

const ACTION_NAMES: Record<CaseAction, string> = {
  APPROVE: "Send the machine",
  CHANGE: "Send a different machine",
  REJECT: "Reject recommendation",
  MARK_IN_FIELD: "Officer in the field",
  RECORD_ACTION_TAKEN: "Record action taken",
  CLOSE: "Close case",
};

function indiaTime(iso: string | undefined) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Kolkata",
  }).format(new Date(iso));
}

export function LiveCaseDetailPanel({
  detail,
  onChanged,
}: {
  detail: CaseDetail;
  onChanged: () => void;
}) {
  const c = detail.case;
  const help = detail.helpRequest;
  const machine = detail.recommendedMachine;
  const [reason, setReason] = useState("");
  const [machineId, setMachineId] = useState(machine?.id ?? "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{
    tone: "success" | "danger" | "warning";
    text: string;
  } | null>(null);

  async function act(action: CaseAction) {
    if (!reason.trim()) {
      setMessage({
        tone: "warning",
        text: "Enter a reason. Every decision is recorded.",
      });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const sendsMachine = action === "APPROVE" || action === "CHANGE";
      await actOnCase(c.id, {
        action,
        reason: reason.trim(),
        previousCaseVersion: c.version,
        ...(sendsMachine && machineId ? { selectedMachineId: machineId } : {}),
      });
      setReason("");
      setMessage({
        tone: "success",
        text: `${ACTION_NAMES[action]} recorded.`,
      });
      onChanged();
    } catch (cause) {
      const error = cause as Error;
      const conflict =
        cause instanceof ApiError && cause.code === "version_conflict";
      setMessage({
        tone: "danger",
        text: conflict
          ? "Another officer changed this case. Reloading it now."
          : error.message,
      });
      if (conflict) onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: "grid", gap: "1rem" }}>
      <Card padding="lg">
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <Badge variant={c.status === "CLOSED" ? "neutral" : "primary"}>
            {c.status.replaceAll("_", " ")}
          </Badge>
          <Badge variant="neutral">
            {c.verificationStatus.replaceAll("_", " ")}
          </Badge>
          <span style={{ color: "#64748b", fontSize: "0.75rem" }}>
            {c.id} · version {c.version}
          </span>
        </div>
        <h2 style={{ marginBottom: "0.25rem" }}>
          {detail.type?.replaceAll("_", " ")} · {detail.report.district}
        </h2>
        <p style={{ color: "#475569" }}>
          Reported {indiaTime(detail.report.reportedAt)} · Deadline{" "}
          {indiaTime(detail.deadline)}
        </p>
        {detail.report.description && <p>“{detail.report.description}”</p>}
      </Card>

      {help && (
        <Card padding="lg" style={{ borderLeft: "6px solid #16a34a" }}>
          <h3 style={{ marginTop: 0 }}>Farmer help request</h3>
          <p>
            {help.crop}, {help.acreage} acres · {help.uncoveredAcres} acres
            still require a {help.machineType}.
          </p>
          {machine ? (
            <p>
              <strong>{machine.machineType}</strong> at {machine.chcName},
              available {indiaTime(machine.availableFrom)}–
              {indiaTime(machine.availableUntil)}.
            </p>
          ) : (
            <p>No matching CHC machine is currently available.</p>
          )}
        </Card>
      )}

      <Card padding="lg">
        <h3 style={{ marginTop: 0 }}>Officer decision</h3>
        {c.status === "CLOSED" ? (
          <p>This case is closed.</p>
        ) : (
          <div style={{ display: "grid", gap: "0.75rem" }}>
            <label style={{ display: "grid", gap: "0.25rem" }}>
              Reason
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                rows={3}
              />
            </label>
            {machine && (
              <label style={{ display: "grid", gap: "0.25rem" }}>
                Machine ID
                <input
                  value={machineId}
                  onChange={(event) => setMachineId(event.target.value)}
                />
              </label>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
              {help?.status === "OPEN" && (
                <Button onClick={() => act("APPROVE")} disabled={busy}>
                  {ACTION_NAMES.APPROVE}
                </Button>
              )}
              {help?.status === "OPEN" && (
                <Button
                  variant="outline"
                  onClick={() => act("CHANGE")}
                  disabled={busy}
                >
                  {ACTION_NAMES.CHANGE}
                </Button>
              )}
              {help && (
                <Button
                  variant="ghost"
                  onClick={() => act("REJECT")}
                  disabled={busy}
                >
                  {ACTION_NAMES.REJECT}
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => act("MARK_IN_FIELD")}
                disabled={busy}
              >
                {ACTION_NAMES.MARK_IN_FIELD}
              </Button>
              <Button
                variant="secondary"
                onClick={() => act("RECORD_ACTION_TAKEN")}
                disabled={busy}
              >
                {ACTION_NAMES.RECORD_ACTION_TAKEN}
              </Button>
              <Button
                variant="danger"
                onClick={() => act("CLOSE")}
                disabled={busy}
              >
                {ACTION_NAMES.CLOSE}
              </Button>
            </div>
          </div>
        )}
        {message && (
          <div style={{ marginTop: "0.75rem" }}>
            <Alert variant={message.tone}>{message.text}</Alert>
          </div>
        )}
      </Card>
    </div>
  );
}
