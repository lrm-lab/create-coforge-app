import assert from "node:assert/strict";
import { test } from "node:test";
import { harness } from "./helpers/service.js";

test("only an authorized browser in the note's workspace can read it", async () => {
  const { request, signIn, agentToken, changeProfile, revoke } = await harness();
  const cookie = await signIn();
  const title = "Visible <note>";
  const agent = await agentToken("workspace-a");
  const create = await request("/api/notes", {
    method: "POST",
    headers: {
      authorization: `Bearer ${agent}`,
      "content-type": "application/json",
      "idempotency-key": "create-one",
    },
    body: JSON.stringify({ title }),
  });
  assert.equal(create.status, 201);
  const note = await create.json();
  assert.equal(note.title, title);
  const otherAgent = await agentToken("workspace-b");
  assert.equal((await request(`/api/notes/${note.id}`, {
    headers: { authorization: `Bearer ${otherAgent}` },
  })).status, 404);
  const page = () => request("/", { headers: { cookie } });
  const matched = await page();
  assert.equal(matched.headers.get("cache-control"), "no-store");
  assert.match(await matched.text(), /Visible &#60;note&#62;/);
  changeProfile({ workspace_id: "workspace-b" });
  assert.doesNotMatch(await (await page()).text(), /Visible/);
  changeProfile({ workspace_id: undefined });
  assert.doesNotMatch(await (await page()).text(), /Visible/);
  assert.doesNotMatch(await (await request("/")).text(), /Visible/);
  revoke();
  assert.equal((await page()).status, 401);
});
