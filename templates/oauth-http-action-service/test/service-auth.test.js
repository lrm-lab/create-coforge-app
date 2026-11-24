import assert from "node:assert/strict";
import { test } from "node:test";
import { harness } from "./helpers/service.js";

test("serves both login and the action manifest at one origin", async () => {
  for (const origin of ["https://example.test", "https://example.test/", "HTTPS://EXAMPLE.TEST:443/"]) {
    const { request, signIn } = await harness(origin);
    const login = await request("/auth/login");
    assert.equal(new URL(login.headers.get("location")).searchParams.get("redirect_uri"), "https://example.test/auth/callback");
    assert.match(login.headers.getSetCookie()[0], /; Secure/i);
    const cookie = await signIn();
    assert.match(await (await request("/", { headers: { cookie } })).text(), /Example/);
    const manifest = await request("/.well-known/coforge-agent-manifest.json");
    assert.equal(manifest.status, 200);
    assert.equal((await manifest.json()).execution.base_url, "https://example.test/api");
  }
});

test("rejects browser sessions and human tokens at an Agent action", async () => {
  const { request, signIn, agentToken } = await harness();
  const cookie = await signIn();
  const token = await agentToken("workspace-a", { type: "user" });
  const wrongAudience = await agentToken("workspace-a", { audience: "another-app" });
  for (const headers of [{ cookie }, { authorization: `Bearer ${token}` }, { authorization: `Bearer ${wrongAudience}` }]) {
    assert.equal((await request("/api/notes/unknown", { headers })).status, 401);
  }
  const agent = await agentToken("workspace-a");
  assert.equal((await request("/api/notes/unknown", { headers: { authorization: `Bearer ${agent}` } })).status, 404);
  const page = await request("/", { headers: { authorization: `Bearer ${agent}` } });
  assert.match(await page.text(), /Sign in with CoForge/);
});
