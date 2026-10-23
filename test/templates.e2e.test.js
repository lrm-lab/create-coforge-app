// Scaffolds each template and runs the generated project's own tests after a real install.
// Needs the npm registry, so it runs only with E2E=1 (CI sets it): `E2E=1 npm test`.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { main } from "../src/cli.js";

const skip = process.env.E2E !== "1" && "set E2E=1 to install and test the generated projects";

for (const template of ["pure-sign-in-web-app", "hosted-http-action-service"]) {
  test(`generated ${template} installs and passes its tests`, { skip, timeout: 300_000 }, async () => {
    const cwd = await mkdtemp(join(tmpdir(), "ccfa-e2e-"));
    const sink = { write() {} };
    assert.equal(await main(["app", "-t", template], { cwd, stdout: sink, stderr: sink, interactive: false }), 0);
    const dir = join(cwd, "app");
    const run = (cmd, args) => spawnSync(cmd, args, { cwd: dir, encoding: "utf8" });
    const install = run("npm", ["install", "--no-audit", "--no-fund"]);
    assert.equal(install.status, 0, install.stderr);
    const test = run("npm", ["test"]);
    assert.equal(test.status, 0, test.stdout + test.stderr);
    // The same tests under Bun's runner, when Bun is installed.
    if (run("bun", ["--version"]).status === 0) {
      const bunTest = run("bun", ["test"]);
      assert.equal(bunTest.status, 0, bunTest.stdout + bunTest.stderr);
    }
  });
}
