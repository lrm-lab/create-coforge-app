import { randomBytes } from "node:crypto";
import { Hono } from "hono";
import { deleteCookie, getCookie, getSignedCookie, setCookie, setSignedCookie } from "hono/cookie";
import { secureHeaders } from "hono/secure-headers";
import { createCoforgeClient } from "./oidc.js";
import { page } from "./views.js";

const SESSION_COOKIE = "session";
const LOGIN_COOKIE = "login"; // short-lived, signed: state, nonce and PKCE verifier
const SESSION_SECONDS = 60 * 60; // CoForge issues no refresh token; sign in again after an hour

/**
 * @param {import("./config.js").Config} config
 * @param {{ client?: ReturnType<typeof createCoforgeClient> }} [deps]
 */
export function createApp(config, { client = createCoforgeClient(config) } = {}) {
  /** Sessions live in memory: fine for a starter, replace with a shared store to run several instances. */
  const sessions = new Map();

  const cookieBase = { httpOnly: true, secure: config.secureCookies, sameSite: "Lax", path: "/" };
  const currentSession = (c) => {
    const id = getCookie(c, SESSION_COOKIE);
    const session = id && sessions.get(id);
    if (!session) return undefined;
    if (session.expiresAt < Date.now()) return sessions.delete(id), undefined;
    return session;
  };

  const sweep = setInterval(() => {
    for (const [id, session] of sessions) if (session.expiresAt < Date.now()) sessions.delete(id);
  }, 5 * 60 * 1000);
  sweep.unref();

  const app = new Hono();
  app.use(secureHeaders());

  app.get("/", (c) => {
    const session = currentSession(c);
    c.header("Cache-Control", "no-store"); // the page shows personal data
    return c.html(page(session));
  });

  app.get("/auth/login", async (c) => {
    const { url, transaction } = await client.beginAuthorization();
    await setSignedCookie(c, LOGIN_COOKIE, JSON.stringify(transaction), config.sessionSecret, {
      ...cookieBase,
      maxAge: 600,
    });
    return c.redirect(url);
  });

  app.get("/auth/callback", async (c) => {
    const raw = await getSignedCookie(c, config.sessionSecret, LOGIN_COOKIE);
    deleteCookie(c, LOGIN_COOKIE, { path: "/" }); // a transaction is single use
    if (!raw) return c.html(page(undefined, "This sign-in expired. Try again."), 400);
    try {
      const result = await client.completeAuthorization(new URL(c.req.url).searchParams, JSON.parse(raw));
      const previous = getCookie(c, SESSION_COOKIE);
      if (previous) sessions.delete(previous); // a new sign-in replaces the old session
      const id = randomBytes(32).toString("base64url");
      sessions.set(id, { ...result, expiresAt: Date.now() + SESSION_SECONDS * 1000 });
      setCookie(c, SESSION_COOKIE, id, { ...cookieBase, maxAge: SESSION_SECONDS });
      return c.redirect("/");
    } catch (error) {
      console.error("sign-in failed:", error.message); // never log tokens, codes or the secret
      return c.html(page(undefined, "Sign-in failed. Try again."), 400);
    }
  });

  // POST so that a link or an image on another site cannot sign the person out.
  app.post("/auth/logout", (c) => {
    const id = getCookie(c, SESSION_COOKIE);
    if (id) sessions.delete(id);
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.redirect("/", 303);
  });

  app.get("/healthz", (c) => c.json({ ok: true }));
  return app;
}
