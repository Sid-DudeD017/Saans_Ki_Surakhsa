const VERIFIER_KEY = "saans_cognito_pkce_verifier";
const STATE_KEY = "saans_cognito_oauth_state";
const ACCESS_TOKEN_KEY = "saans_cognito_access_token";
const ID_TOKEN_KEY = "saans_cognito_id_token";
const EXPIRES_AT_KEY = "saans_cognito_expires_at";

type TokenResponse = {
  access_token: string;
  id_token?: string;
  expires_in: number;
  token_type: string;
};

function browserStorage(): Storage {
  if (typeof window === "undefined")
    throw new Error("Cognito authentication is only available in the browser.");
  return window.sessionStorage;
}

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name} configuration.`);
  return value;
}

function config() {
  const region = required(
    "NEXT_PUBLIC_COGNITO_REGION",
    process.env.NEXT_PUBLIC_COGNITO_REGION,
  );
  const domainSetting = required(
    "NEXT_PUBLIC_COGNITO_DOMAIN",
    process.env.NEXT_PUBLIC_COGNITO_DOMAIN,
  );
  const domain = domainSetting.startsWith("https://")
    ? domainSetting.replace(/\/+$/, "")
    : `https://${domainSetting}.auth.${region}.amazoncognito.com`;

  return {
    clientId: required(
      "NEXT_PUBLIC_COGNITO_CLIENT_ID",
      process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
    ),
    domain,
    redirectUri: required(
      "NEXT_PUBLIC_COGNITO_REDIRECT_URI",
      process.env.NEXT_PUBLIC_COGNITO_REDIRECT_URI,
    ),
    logoutUri: required(
      "NEXT_PUBLIC_COGNITO_LOGOUT_URI",
      process.env.NEXT_PUBLIC_COGNITO_LOGOUT_URI,
    ),
  };
}

function base64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export function generateRandomValue(byteLength = 32): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return base64Url(bytes);
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(verifier),
  );
  return base64Url(new Uint8Array(digest));
}

export async function beginCognitoLogin(): Promise<void> {
  const { clientId, domain, redirectUri } = config();
  const storage = browserStorage();
  const verifier = generateRandomValue(64);
  const state = generateRandomValue(32);
  const challenge = await createCodeChallenge(verifier);

  storage.setItem(VERIFIER_KEY, verifier);
  storage.setItem(STATE_KEY, state);

  const query = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    scope: "openid email profile",
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  });
  window.location.assign(`${domain}/oauth2/authorize?${query}`);
}

export async function handleCognitoCallback(
  search = window.location.search,
): Promise<void> {
  const params = new URLSearchParams(search);
  const oauthError = params.get("error");
  if (oauthError) {
    const detail = params.get("error_description");
    throw new Error(detail || oauthError);
  }

  const code = params.get("code");
  const returnedState = params.get("state");
  const storage = browserStorage();
  const expectedState = storage.getItem(STATE_KEY);
  const verifier = storage.getItem(VERIFIER_KEY);

  if (!code) throw new Error("Cognito did not return an authorization code.");
  if (!returnedState || !expectedState || returnedState !== expectedState) {
    clearCognitoSession();
    throw new Error(
      "The sign-in response could not be verified. Please start sign-in again.",
    );
  }
  if (!verifier) {
    clearCognitoSession();
    throw new Error("The sign-in session expired. Please start sign-in again.");
  }

  const { clientId, domain, redirectUri } = config();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: clientId,
    code,
    redirect_uri: redirectUri,
    code_verifier: verifier,
  });
  const response = await fetch(`${domain}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json().catch(() => null)) as
    TokenResponse | { error?: string; error_description?: string } | null;
  if (!response.ok || !payload || !("access_token" in payload)) {
    clearCognitoSession();
    throw new Error(
      payload && "error_description" in payload && payload.error_description
        ? payload.error_description
        : "Cognito could not complete sign-in.",
    );
  }

  storage.setItem(ACCESS_TOKEN_KEY, payload.access_token);
  if (payload.id_token) storage.setItem(ID_TOKEN_KEY, payload.id_token);
  storage.setItem(
    EXPIRES_AT_KEY,
    String(Date.now() + payload.expires_in * 1000),
  );
  storage.removeItem(VERIFIER_KEY);
  storage.removeItem(STATE_KEY);
}

export function getCognitoAccessToken(now = Date.now()): string | null {
  if (typeof window === "undefined") return null;
  const storage = window.sessionStorage;
  const token = storage.getItem(ACCESS_TOKEN_KEY);
  const expiresAt = Number(storage.getItem(EXPIRES_AT_KEY));
  if (!token || !Number.isFinite(expiresAt) || expiresAt <= now + 30_000) {
    clearCognitoSession();
    return null;
  }
  return token;
}

export function isCognitoAuthenticated(): boolean {
  return getCognitoAccessToken() !== null;
}

export function clearCognitoSession(): void {
  if (typeof window === "undefined") return;
  const storage = window.sessionStorage;
  [
    VERIFIER_KEY,
    STATE_KEY,
    ACCESS_TOKEN_KEY,
    ID_TOKEN_KEY,
    EXPIRES_AT_KEY,
  ].forEach((key) => storage.removeItem(key));
}

export function signOut(): void {
  const { clientId, domain, logoutUri } = config();
  clearCognitoSession();
  const query = new URLSearchParams({
    client_id: clientId,
    logout_uri: logoutUri,
  });
  window.location.assign(`${domain}/logout?${query}`);
}
