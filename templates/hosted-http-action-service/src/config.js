/** @typedef {{ issuer: string, clientId: string, appOrigin: string, port: number }} Config */

/**
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
  const appUrl = new URL(need("APP_ORIGIN"));
  if (issuer.endsWith("/")) throw new Error("COFORGE_ISSUER must not end with a slash");
  for (const [name, url] of [["COFORGE_ISSUER", new URL(issuer)], ["APP_ORIGIN", appUrl]]) {
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) {
      throw new Error(`${name} must be https (http is accepted only for localhost)`);
    }
    if (url.search || url.hash || url.username || url.password) throw new Error(`${name} must be a plain URL`);
  }
  if (appUrl.pathname !== "/") throw new Error("APP_ORIGIN must be an origin, without a path");
  return { issuer, clientId: need("COFORGE_CLIENT_ID"), appOrigin: appUrl.origin, port: Number(env.PORT || 3000) };
}
