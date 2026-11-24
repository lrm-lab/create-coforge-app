import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const cli = fileURLToPath(new URL("../src/cli.js", import.meta.url));
const readJson = async (path) => JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
const run = (args, storage) => spawnSync(process.execPath, [cli, ...args], {
  env: { ...process.env, COFORGE_LOCAL_CLI_HOME: storage ?? "" },
  encoding: "utf8",
  timeout: 15_000,
  windowsHide: true,
});

test("declares the installed bare command in a valid local CLI manifest", async () => {
  const manifest = await readJson("../manifest.example.json");
  const pkg = await readJson("../package.json");
  const ajv = new Ajv2020({ strict: false, allErrors: true });
  addFormats(ajv);
  const validate = ajv.compile(await readJson("./fixtures/coforge-agent-manifest.v1.schema.json"));
  assert.ok(validate(manifest), JSON.stringify(validate.errors));
  assert.equal(manifest.execution.mode, "local_cli");
  assert.equal(pkg.bin[manifest.execution.command], "src/cli.js");
  assert.equal(manifest.actions, undefined);
});

test("runs the wrapped tool with literal arguments and separate Agent homes", async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "coforge-local-cli-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  for (const agent of ["first-agent", "second-agent"]) {
    const home = join(root, agent);
    const result = run(["summarize", "a ; b"], home);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { words: 3 });
    assert.match(await realpath(join(home, "__COMMAND_NAME__", "config")), new RegExp(agent));
  }
});

test("refuses a missing home and an unsafe command", () => {
  assert.equal(run(["--help"]).status, 0);
  assert.equal(run(["summarize", "one"]).status, 1);
  assert.equal(run(["unknown", "one"]).status, 2);
});

test("refuses a symlink in place of the tool's private directory", { skip: process.platform === "win32" }, async (t) => {
  const root = await realpath(await mkdtemp(join(tmpdir(), "coforge-local-cli-")));
  t.after(() => rm(root, { recursive: true, force: true }));
  const home = join(root, "agent");
  const other = join(root, "other");
  await mkdir(home, { mode: 0o700 });
  await mkdir(other, { mode: 0o700 });
  await symlink(other, join(home, "__COMMAND_NAME__"));
  assert.equal(run(["summarize", "one"], home).status, 1);
});
