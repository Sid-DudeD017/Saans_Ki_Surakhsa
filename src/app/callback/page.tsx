"use client";

import { useEffect, useState } from "react";
import { Card, Container } from "../../components/ui";
import { handleCognitoCallback } from "../../lib/cognitoAuth";

export default function CognitoCallbackPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    handleCognitoCallback()
      .then(() => {
        if (active) window.location.replace("/command");
      })
      .catch((cause: unknown) => {
        if (active)
          setError(
            cause instanceof Error
              ? cause.message
              : "Sign-in could not be completed.",
          );
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Container maxWidth="sm" style={{ paddingTop: "4rem" }}>
      <Card padding="lg">
        <h1 style={{ marginTop: 0 }}>Officer sign-in</h1>
        {error ? (
          <>
            <p role="alert" style={{ color: "#b91c1c" }}>
              {error}
            </p>
            <button
              type="button"
              onClick={() => window.location.replace("/command")}
            >
              Return to Command
            </button>
          </>
        ) : (
          <p aria-live="polite">Completing secure sign-in…</p>
        )}
      </Card>
    </Container>
  );
}
