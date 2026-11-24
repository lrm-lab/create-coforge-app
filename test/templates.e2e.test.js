// Scaffolds each template and runs the generated project's own tests after a real install.
// Needs the npm registry, so it runs only with E2E=1 (CI sets it): `E2E=1 npm test`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const skip = process.env.E2E !== "1" && "set E2E=1 to install and test the generated projects";
const childEnv = { ...process.env };
delete childEnv.NODE_TEST_CONTEXT;

let cwd;
test.before(async () => {
  if (skip) return;
  cwd = await mkdtemp(join(tmpdir(), "ccfa-e2e-"));
  const repo = fileURLToPath(new URL("../", import.meta.url));
  const pack = spawnSync("npm", ["pack", "--json", "--pack-destination", cwd], { cwd: repo, encoding: "utf8" });
  assert.equal(pack.status, 0, pack.stderr);
  const filename = JSON.parse(pack.stdout)[0].filename;
  const install = spawnSync("npm", ["install", "--no-audit", "--no-fund", join(cwd, filename)], { cwd, encoding: "utf8" });
  assert.equal(install.status, 0, install.stderr);
});
test.after(async () => {
  if (cwd) await rm(cwd, { recursive: true, force: true });
});

for (const template of [
  "pure-sign-in-web-app",
  "hosted-http-action-service",
  "oauth-http-action-service",
  "hosted-dual-human-agent-app",
  "local-cli-wrapper",
]) {
  test(`packed ${template} installs and passes its tests`, { skip, timeout: 300_000 }, async () => {
    const executable = join(cwd, "node_modules/create-coforge-app/bin/create-coforge-app.js");
    const generated = spawnSync(process.execPath, [executable, template, "-t", template], { cwd, encoding: "utf8" });
    assert.equal(generated.status, 0, generated.stderr);
    const dir = join(cwd, template);
    const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: "utf8", env: childEnv });
    const install = run("npm", ["install", "--no-audit", "--no-fund"]);
    assert.equal(install.status, 0, install.stderr);
    const test = run("npm", ["test"]);
    assert.equal(test.status, 0, test.stdout + test.stderr);
    // The same tests under Bun's runner, when Bun is installed.
    if (run("bun", ["--version"]).status === 0) {
      const bunTest = run("bun", ["test"]);
      assert.equal(bunTest.status, 0, bunTest.stdout + bunTest.stderr);
    }
    if (template === "local-cli-wrapper") {
      const pack = run("npm", ["pack", "--json", "--pack-destination", cwd]);
      assert.equal(pack.status, 0, pack.stderr);
      const filename = JSON.parse(pack.stdout)[0].filename;
      const installCommand = spawnSync("npm", ["install", "--no-audit", "--no-fund", join(cwd, filename)], {
        cwd,
        encoding: "utf8",
      });
      assert.equal(installCommand.status, 0, installCommand.stderr);
      const command = process.platform === "win32"
        ? join(cwd, "node_modules", template, "src", "cli.js")
        : join(cwd, "node_modules", ".bin", template);
      const invocation = spawnSync(process.execPath, [command, "summarize", "one two"], {
        cwd,
        encoding: "utf8",
        env: { ...process.env, COFORGE_LOCAL_CLI_HOME: join(cwd, "agent-home") },
      });
      assert.equal(invocation.status, 0, invocation.stderr);
      assert.deepEqual(JSON.parse(invocation.stdout), { words: 2 });
    }
  });
}
