import assert from "node:assert/strict";
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair } from "jose";
import { createService } from "../../src/service.js";
import { loadConfig } from "../../src/web-config.js";

const origin = "https://example.test";
const issuer = "https://coforge.example.test/oidc";
const clientId = "sample-app";
export async function harness(appOrigin = origin) {
  const config = loadConfig({
    APP_ORIGIN: appOrigin,
    COFORGE_ISSUER: issuer,
    COFORGE_CLIENT_ID: clientId,
    COFORGE_CLIENT_SECRET: "synthetic-test-value",
    SESSION_SECRET: "k3j9Zq0wX7vB2nL5mR8tY1uC4pD6fG0hJ",
  });
  const keys = await generateKeyPair("ES256");
  const kid = "local-key";
  const jwk = { ...await exportJWK(keys.publicKey), kid };
  let profile = { sub: "test-user", type: "user", name: "Example", workspace_id: "workspace-a" };
  let authorized = true;
  const webClient = {
    beginAuthorization: async () => ({
      url: `${issuer}/auth?${new URLSearchParams({ redirect_uri: config.redirectUri })}`,
      transaction: { state: "local-state" },
    }),
    async completeAuthorization(query, transaction) {
      assert.equal(query.get("state"), transaction.state);
      return {
        sub: profile.sub,
        profile,
        async readProfile() {
          if (!authorized) throw new Error("Authorization revoked");
          return profile;
        },
      };
    },
  };
  const app = createService(config, { webClient, agentKeys: createLocalJWKSet({ keys: [jwk] }) });
  const request = (path, init) => app.request(`${origin}${path}`, init);
  const cookie = (res, key) => res.headers.getSetCookie().find((header) => header.startsWith(`${key}=`)).split(";")[0];
  const signIn = async () => {
    const login = await request("/auth/login");
    assert.equal(login.status, 302);
    const callback = await request("/auth/callback?state=local-state", { headers: { cookie: cookie(login, "login") } });
    assert.equal(callback.status, 302);
    return cookie(callback, "session");
  };
  async function agentToken(workspaceId, { type = "agent", audience = clientId } = {}) {
    return new SignJWT({ type, workspace_id: workspaceId, scope: "openid profile identity" })
      .setProtectedHeader({ typ: "at+jwt", alg: "ES256", kid })
      .setSubject("test-agent")
      .setIssuer(issuer)
      .setAudience(audience)
      .setExpirationTime("5m")
      .sign(keys.privateKey);
  }
  return { request, signIn, agentToken, changeProfile: (fields) => { profile = { ...profile, ...fields }; }, revoke: () => { authorized = false; } };
}
