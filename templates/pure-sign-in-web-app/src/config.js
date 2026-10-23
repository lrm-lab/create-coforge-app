/**
 * @typedef {{
 *   issuer: string, clientId: string, clientSecret: string, scopes: string[],
 *   appOrigin: string, redirectUri: string, sessionSecret: string,
 *   port: number, secureCookies: boolean,
 * }} Config
 */

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Read and validate the environment once, at boot, so a bad setup fails loudly
 * (naming the variable, never its value).
 * @param {Record<string, string | undefined>} env
 * @returns {Config}
 */
export function loadConfig(env = process.env) {
  const need = (name) => {
    const value = env[name]?.trim();
    if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
    return value;
  };

  const issuer = need("COFORGE_ISSUER");
  const appOrigin = need("APP_ORIGIN");
  requireOrigin("COFORGE_ISSUER", issuer, { allowPath: true });
  requireOrigin("APP_ORIGIN", appOrigin, { allowPath: false });
  if (issuer.endsWith("/")) throw new Error("COFORGE_ISSUER must not end with a slash");

  const sessionSecret = need("SESSION_SECRET");
  if (sessionSecret.length < 32 || isPlaceholder(sessionSecret)) {
    throw new Error("SESSION_SECRET must be a real random value of 32+ characters (openssl rand -base64 48)");
  }
  const clientSecret = need("COFORGE_CLIENT_SECRET");
  if (isPlaceholder(clientSecret)) throw new Error("COFORGE_CLIENT_SECRET is still a placeholder");

  const port = env.PORT?.trim() ? Number(env.PORT) : 3000;
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT must be an integer from 1 to 65535");

  const scopes = (env.COFORGE_SCOPES?.trim() || "openid profile identity").split(/\s+/);
  if (!scopes.includes("openid")) throw new Error("COFORGE_SCOPES must include openid");

  return {
    issuer,
    clientId: need("COFORGE_CLIENT_ID"),
    clientSecret,
    scopes,
    appOrigin,
    redirectUri: `${appOrigin}/auth/callback`,
    sessionSecret,
    port,
    secureCookies: appOrigin.startsWith("https://"),
  };
}

/** Values copied from an example file rather than chosen: "replace-with-...", "changeme", "xxxx". */
const isPlaceholder = (value) => /^(replace|change|your[-_]|example|placeholder|todo)|^(.)\2*$/i.test(value);

function requireOrigin(name, value, { allowPath }) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${name} is not a valid URL`);
  }
  const httpOk = url.protocol === "http:" && LOOPBACK.has(url.hostname);
  if (url.protocol !== "https:" && !httpOk) {
    throw new Error(`${name} must be https (http is accepted only for localhost)`);
  }
  if (url.search || url.hash || url.username) throw new Error(`${name} must be a plain URL`);
  if (!allowPath && url.pathname !== "/") throw new Error(`${name} must be an origin, without a path`);
}
