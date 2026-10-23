import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { SignJWT, exportJWK, generateKeyPair } from "jose";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

// A stand-in CoForge authorization server on a loopback port, following
// docs/authorization-server: discovery, /auth, /token, /me, /jwks, ES256 ID tokens.
const CLIENT_ID = "demo-app";
const CLIENT_SECRET = "s3cret";
const APP_ORIGIN = "http://localhost:3000";
const REDIRECT_URI = `${APP_ORIGIN}/auth/callback`;

let idp;
let issuer;
let keys;
const issued = new Map(); // code -> { challenge, nonce }
let tamper = {}; // per-test ID token overrides

function startIdp() {
  const app = new Hono();
  app.get("/oidc/.well-known/openid-configuration", (c) =>
    c.json({
      issuer,
      authorization_endpoint: `${issuer}/auth`,
      token_endpoint: `${issuer}/token`,
      userinfo_endpoint: `${issuer}/me`,
      jwks_uri: `${issuer}/jwks`,
    }),
  );
  app.get("/oidc/jwks", async (c) => c.json({ keys: [{ ...(await exportJWK(keys.publicKey)), kid: "k1", alg: "ES256" }] }));
  app.post("/oidc/token", async (c) => {
    const expected = `Basic ${Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64")}`;
    if (c.req.header("authorization") !== expected) return c.json({ error: "invalid_client" }, 401);
    const form = await c.req.parseBody();
    const grant = issued.get(form.code);
    const verifierHash = createHash("sha256").update(String(form.code_verifier)).digest("base64url");
    if (!grant || grant.challenge !== verifierHash || form.redirect_uri !== REDIRECT_URI) {
      return c.json({ error: "invalid_grant" }, 400);
    }
    issued.delete(form.code);
    const access_token = "access-token-1";
    const at_hash = createHash("sha256").update(access_token).digest().subarray(0, 16).toString("base64url");
    const id_token = await new SignJWT({ nonce: grant.nonce, at_hash, auth_time: 1, ...tamper })
      .setProtectedHeader({ alg: "ES256", kid: "k1" })
      .setIssuer(tamper.iss ?? issuer)
      .setAudience(CLIENT_ID)
      .setSubject("user-1")
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(keys.privateKey);
    return c.json({ access_token, token_type: "Bearer", expires_in: 3600, id_token, scope: "openid profile identity" });
  });
  app.get("/oidc/me", (c) =>
    c.req.header("authorization") === "Bearer access-token-1"
      ? c.json({ sub: "user-1", name: "Ada <b>Lovelace</b>", type: "user", workspace_id: "w1", workspace_slug: "acme", workspace_role: "admin" })
      : c.json({ error: "invalid_token" }, 401),
  );
  return new Promise((resolve) => {
    const server = serve({ fetch: app.fetch, port: 0, hostname: "127.0.0.1" }, ({ port }) => resolve({ server, port }));
  });
}

const config = () =>
  loadConfig({
    COFORGE_ISSUER: issuer,
    COFORGE_CLIENT_ID: CLIENT_ID,
    COFORGE_CLIENT_SECRET: CLIENT_SECRET,
    APP_ORIGIN,
    SESSION_SECRET: "k3j9Zq0wX7vB2nL5mR8tY1uC4pD6fG0hJ",
  });

/** Minimal cookie jar around app.request. */
function browser(app) {
  const jar = new Map();
  const send = async (path, init = {}) => {
    const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await app.request(`${APP_ORIGIN}${path}`, { ...init, headers: { ...init.headers, cookie } });
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split("; ");
      const [name, value] = [pair.slice(0, pair.indexOf("=")), pair.slice(pair.indexOf("=") + 1)];
      if (value === "" || attrs.some((a) => /^max-age=0$/i.test(a))) jar.delete(name);
      else jar.set(name, value);
    }
    return res;
  };
  return { send, jar };
}

/** Walk login -> IdP /auth (simulated) -> callback; returns the callback response. */
async function signIn(b, { mutateCallback = (u) => u } = {}) {
  const login = await b.send("/auth/login");
  assert.equal(login.status, 302);
  const auth = new URL(login.headers.get("location"));
  assert.equal(auth.origin + auth.pathname, `${issuer}/auth`);
  assert.equal(auth.searchParams.get("code_challenge_method"), "S256");
  assert.equal(auth.searchParams.get("redirect_uri"), REDIRECT_URI);
  const code = `code-${issued.size + 1}-${Math.random()}`;
  issued.set(code, { challenge: auth.searchParams.get("code_challenge"), nonce: auth.searchParams.get("nonce") });
  const callback = new URL(REDIRECT_URI);
  callback.searchParams.set("code", code);
  callback.searchParams.set("state", auth.searchParams.get("state"));
  callback.searchParams.set("iss", issuer);
  const url = mutateCallback(callback);
  return b.send(`${url.pathname}${url.search}`);
}

describe("Sign in with CoForge", () => {
  before(async () => {
    keys = await generateKeyPair("ES256");
    const started = await startIdp();
    idp = started.server;
    issuer = `http://127.0.0.1:${started.port}/oidc`;
  });
  after(() => idp.close());

  test("signs in, shows escaped profile and Workspace, signs out", async () => {
    tamper = {};
    const b = browser(createApp(config()));
    const done = await signIn(b);
    assert.equal(done.status, 302);
    const session = done.headers.getSetCookie().find((c) => c.startsWith("session="));
    assert.match(session, /HttpOnly/i);
    assert.match(session, /SameSite=Lax/i);
    assert.doesNotMatch(session, /Secure/i); // APP_ORIGIN is http://localhost

    const home = await (await b.send("/")).text();
    assert.match(home, /Ada &#60;b&#62;Lovelace/);
    assert.match(home, /acme \(admin\)/);

    const out = await b.send("/auth/logout", { method: "POST" });
    assert.equal(out.status, 303);
    assert.match(await (await b.send("/")).text(), /Sign in with CoForge/);
  });

  test("session cookie is Secure on an https APP_ORIGIN", async () => {
    tamper = {};
    const app = createApp({ ...config(), appOrigin: "https://app.example.com", secureCookies: true });
    const login = await app.request("https://app.example.com/auth/login");
    assert.match(login.headers.getSetCookie().join("\n"), /Secure/i);
  });

  test("rejects a wrong state", async () => {
    tamper = {};
    const res = await signIn(browser(createApp(config())), {
      mutateCallback: (u) => (u.searchParams.set("state", "other"), u),
    });
    assert.equal(res.status, 400);
  });

  test("rejects a missing or different iss parameter", async () => {
    tamper = {};
    for (const mutate of [(u) => (u.searchParams.delete("iss"), u), (u) => (u.searchParams.set("iss", "https://evil.example/oidc"), u)]) {
      assert.equal((await signIn(browser(createApp(config())), { mutateCallback: mutate })).status, 400);
    }
  });

  test("rejects an ID token with a wrong nonce or issuer", async () => {
    tamper = { nonce: "forged" };
    assert.equal((await signIn(browser(createApp(config())))).status, 400);
    tamper = { iss: "https://evil.example/oidc" };
    assert.equal((await signIn(browser(createApp(config())))).status, 400);
  });

  test("an authorization error from CoForge is not a sign-in", async () => {
    tamper = {};
    const res = await signIn(browser(createApp(config())), {
      mutateCallback: (u) => (u.searchParams.delete("code"), u.searchParams.set("error", "access_denied"), u),
    });
    assert.equal(res.status, 400);
  });

  test("a callback without the login cookie is refused", async () => {
    const res = await createApp(config()).request(`${REDIRECT_URI}?code=x&state=y&iss=${issuer}`);
    assert.equal(res.status, 400);
  });

  test("a new sign-in ends the previous session; the page is never cached", async () => {
    tamper = {};
    const b = browser(createApp(config()));
    await signIn(b);
    const first = b.jar.get("session");
    await signIn(b);
    assert.notEqual(b.jar.get("session"), first);
    const home = await b.send("/");
    assert.equal(home.headers.get("cache-control"), "no-store");
    // the replaced session id no longer works in the same app
    const app = createApp(config());
    const b2 = browser(app);
    await signIn(b2);
    const old = b2.jar.get("session");
    await signIn(b2);
    const replay = await app.request(`${APP_ORIGIN}/`, { headers: { cookie: `session=${old}` } });
    assert.match(await replay.text(), /Sign in with CoForge/);
  });

  test("config refuses placeholder and empty secrets and a bad PORT", () => {
    const base = { COFORGE_ISSUER: issuer, COFORGE_CLIENT_ID: "a", COFORGE_CLIENT_SECRET: "real-secret-value", APP_ORIGIN, SESSION_SECRET: "k3j9Zq0wX7vB2nL5mR8tY1uC4pD6fG0hJ" };
    assert.ok(loadConfig(base));
    for (const bad of [
      { SESSION_SECRET: "" },
      { SESSION_SECRET: "replace-with-a-long-random-string" },
      { SESSION_SECRET: "x".repeat(40) },
      { COFORGE_CLIENT_SECRET: "" },
      { COFORGE_CLIENT_SECRET: "replace-with-the-secret-shown-once" },
      { PORT: "abc" },
      { PORT: "70000" },
    ]) {
      assert.throws(() => loadConfig({ ...base, ...bad }), Error, JSON.stringify(bad));
    }
  });

  test("an error code from CoForge is not echoed into logs verbatim", async () => {
    tamper = {};
    const lines = [];
    const original = console.error;
    console.error = (...args) => lines.push(args.join(" "));
    try {
      await signIn(browser(createApp(config())), {
        mutateCallback: (u) => (u.searchParams.delete("code"), u.searchParams.set("error", "x\nFAKE LOG LINE"), u),
      });
    } finally {
      console.error = original;
    }
    assert.ok(lines.length > 0);
    assert.ok(!lines.join("\n").includes("FAKE LOG LINE"));
  });

  test("config refuses a missing secret and a short session secret", () => {
    assert.throws(() => loadConfig({}), /COFORGE_ISSUER/);
    assert.throws(
      () => loadConfig({ COFORGE_ISSUER: issuer, COFORGE_CLIENT_ID: "a", COFORGE_CLIENT_SECRET: "b", APP_ORIGIN, SESSION_SECRET: "short", COFORGE_CLIENT_SECRET: "b" }),
      /SESSION_SECRET/,
    );
  });
});
