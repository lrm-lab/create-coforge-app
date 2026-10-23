import { createHash, randomBytes } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";

const FETCH_TIMEOUT_MS = 10_000;
/** Every call to CoForge is bounded, so a stalled server cannot hang a sign-in. */
const get = (url, init = {}) => fetch(url, { ...init, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
/** An error code from the network is untrusted: keep it only if it looks like an OAuth code. */
const safeCode = (value) => (typeof value === "string" && /^[A-Za-z0-9_.-]{1,64}$/.test(value) ? value : "invalid");

const b64url = (buffer) => Buffer.from(buffer).toString("base64url");

/** A random URL-safe string for state, nonce and the PKCE verifier (43 characters). */
export const randomToken = () => b64url(randomBytes(32));

/** PKCE S256 challenge for a verifier (RFC 7636 section 4.2). */
export const pkceChallenge = (verifier) => b64url(createHash("sha256").update(verifier).digest());

/** at_hash: the left half of the access token's SHA-256, base64url (OIDC Core 3.1.3.6). */
const atHash = (accessToken) => b64url(createHash("sha256").update(accessToken).digest().subarray(0, 16));

/**
 * The OpenID Connect client for CoForge: discovery, the authorization URL, the
 * code exchange, ID token verification, and UserInfo. It holds no per-person state.
 * @param {import("./config.js").Config} config
 */
export function createCoforgeClient(config) {
  let metadataPromise;
  let jwks;

  /** Discovery document, fetched once; its issuer must be exactly the configured one. */
  const metadata = () => {
    metadataPromise ??= (async () => {
      const response = await get(`${config.issuer}/.well-known/openid-configuration`);
      if (!response.ok) throw new Error(`CoForge discovery failed: HTTP ${response.status}`);
      const doc = await response.json();
      if (doc.issuer !== config.issuer) throw new Error("Discovery issuer does not match COFORGE_ISSUER");
      for (const key of ["authorization_endpoint", "token_endpoint", "userinfo_endpoint", "jwks_uri"]) {
        if (typeof doc[key] !== "string") throw new Error(`Discovery document lacks ${key}`);
      }
      jwks = createRemoteJWKSet(new URL(doc.jwks_uri), { timeoutDuration: FETCH_TIMEOUT_MS });
      return doc;
    })().catch((error) => {
      metadataPromise = undefined; // retry on the next request
      throw error;
    });
    return metadataPromise;
  };

  return {
    /**
     * Start a sign-in: the URL to send the browser to, and the values to keep
     * (server-side, tied to this browser) until the callback.
     */
    async beginAuthorization() {
      const doc = await metadata();
      const transaction = { state: randomToken(), nonce: randomToken(), codeVerifier: randomToken() };
      const url = new URL(doc.authorization_endpoint);
      url.search = new URLSearchParams({
        response_type: "code",
        client_id: config.clientId,
        redirect_uri: config.redirectUri,
        scope: config.scopes.join(" "),
        state: transaction.state,
        nonce: transaction.nonce,
        code_challenge: pkceChallenge(transaction.codeVerifier),
        code_challenge_method: "S256",
      }).toString();
      return { url: url.toString(), transaction };
    },

    /**
     * Finish a sign-in from the callback's query parameters. Throws on anything
     * that does not check out; the caller shows a generic failure.
     * @param {URLSearchParams} query
     * @param {{ state: string, nonce: string, codeVerifier: string }} transaction
     */
    async completeAuthorization(query, transaction) {
      const doc = await metadata();
      // RFC 9207: CoForge sends iss on every authorization response, errors included.
      if (query.get("iss") !== config.issuer) throw new Error("Authorization response iss mismatch");
      if (query.get("state") !== transaction.state) throw new Error("Authorization response state mismatch");
      const error = query.get("error");
      if (error) throw new Error(`Authorization refused: ${safeCode(error)}`);
      const code = query.get("code");
      if (!code) throw new Error("Authorization response has no code");

      const tokens = await exchangeCode(doc, code, transaction.codeVerifier);
      const { payload: idClaims } = await jwtVerify(tokens.id_token, jwks, {
        issuer: config.issuer,
        audience: config.clientId,
        algorithms: ["ES256"],
      });
      if (idClaims.nonce !== transaction.nonce) throw new Error("ID token nonce mismatch");
      if (idClaims.at_hash !== atHash(tokens.access_token)) throw new Error("ID token at_hash mismatch");

      const profile = await userInfo(doc, tokens.access_token);
      // The ID token proves who signed in; UserInfo must describe the same person.
      if (profile.sub !== idClaims.sub) throw new Error("UserInfo sub does not match the ID token");
      return { sub: idClaims.sub, authTime: idClaims.auth_time, profile };
    },
  };

  /** client_secret_basic: id and secret form-encoded, then Base64 (RFC 6749 section 2.3.1). */
  function basicAuth() {
    const part = (value) => encodeURIComponent(value).replace(/%20/g, "+");
    return `Basic ${Buffer.from(`${part(config.clientId)}:${part(config.clientSecret)}`).toString("base64")}`;
  }

  async function exchangeCode(doc, code, codeVerifier) {
    const response = await get(doc.token_endpoint, {
      method: "POST",
      headers: { authorization: basicAuth(), "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: config.redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`Token exchange failed: ${safeCode(body.error)}/${response.status}`);
    if (typeof body.access_token !== "string" || typeof body.id_token !== "string") {
      throw new Error("Token response lacks access_token or id_token");
    }
    return body;
  }

  async function userInfo(doc, accessToken) {
    const response = await get(doc.userinfo_endpoint, {
      headers: { authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) throw new Error(`UserInfo failed: HTTP ${response.status}`);
    return response.json();
  }
}
