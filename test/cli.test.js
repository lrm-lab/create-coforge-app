import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { main } from "../src/cli.js";
import { toPackageName } from "../src/scaffold.js";

const sink = () => {
  let text = "";
  return { write: (chunk) => void (text += chunk), get text() { return text; } };
};
const run = async (args, cwd) => {
  const stdout = sink();
  const stderr = sink();
  const code = await main(args, { cwd, stdout, stderr, interactive: false });
  return { code, stdout: stdout.text, stderr: stderr.text };
};
const tmp = () => mkdtemp(join(tmpdir(), "create-coforge-app-"));
const templates = [
  "hosted-dual-human-agent-app",
  "hosted-http-action-service",
  "local-cli-wrapper",
  "oauth-http-action-service",
  "pure-sign-in-web-app",
];

test("--list-templates names all five templates", async () => {
  const { code, stdout } = await run(["--list-templates"], await tmp());
  assert.equal(code, 0);
  const names = stdout.trimEnd().split("\n").filter((line) => !line.startsWith(" "));
  assert.deepEqual(names, templates);
});

for (const template of templates) {
  test(`scaffolds ${template} with placeholders filled`, async () => {
    const cwd = await tmp();
    const { code, stdout } = await run(["My App", "--template", template], cwd);
    assert.equal(code, 0);
    assert.match(stdout, /Next steps/);
    const dir = join(cwd, "My App");
    const files = await readdir(dir);
    for (const expected of [".gitignore", "README.md", "AGENTS.md", "package.json", "test"]) {
      assert.ok(files.includes(expected), `${expected} present`);
    }
    assert.ok(!files.includes("_gitignore") && !files.includes("template.json"));
    const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
    assert.equal(pkg.name, "my-app");
    const implementation = template === "local-cli-wrapper"
      ? ["manifest.example.json", "src/cli.js"]
      : [".env.example", "src/server.js"];
    for (const file of ["README.md", "AGENTS.md", ...implementation]) {
      assert.doesNotMatch(await readFile(join(dir, file), "utf8"), /__(APP_NAME|PACKAGE_NAME|COMMAND_NAME)__/, file);
    }
  });
}

test("refuses a non-empty directory and leaves it alone", async () => {
  const cwd = await tmp();
  await mkdir(join(cwd, "app"));
  await writeFile(join(cwd, "app", "keep.txt"), "x");
  const { code, stderr } = await run(["app", "--yes"], cwd);
  assert.equal(code, 1);
  assert.match(stderr, /not empty/);
  assert.deepEqual(await readdir(join(cwd, "app")), ["keep.txt"]);
});

test("accepts an existing empty directory", async () => {
  const cwd = await tmp();
  await mkdir(join(cwd, "empty"));
  assert.equal((await run(["empty", "--yes"], cwd)).code, 0);
});

test("rejects an unknown template and, without a terminal, a missing directory", async () => {
  const cwd = await tmp();
  assert.equal((await run(["x", "-t", "nope"], cwd)).code, 2);
  assert.equal((await run([], cwd)).code, 2);
});

test("--yes uses the default directory and template", async () => {
  const cwd = await tmp();
  assert.equal((await run(["--yes"], cwd)).code, 0);
  assert.ok((await readdir(join(cwd, "my-coforge-app"))).includes("package.json"));
});

test("toPackageName makes a valid npm name", () => {
  assert.equal(toPackageName("My Cool_App!"), "my-cool_app");
  assert.equal(toPackageName("---"), "coforge-app");
});

test("a failed copy leaves nothing behind", async () => {
  const { scaffold } = await import("../src/scaffold.js");
  const cwd = await tmp();
  await assert.rejects(scaffold({ templateDir: join(cwd, "no-such-template"), targetDir: join(cwd, "fresh") }));
  assert.deepEqual(await readdir(cwd), []);
  await mkdir(join(cwd, "given"));
  await assert.rejects(scaffold({ templateDir: join(cwd, "no-such-template"), targetDir: join(cwd, "given") }));
  assert.deepEqual(await readdir(join(cwd, "given")), []);
});

test("closed stdin ends a prompt with a message and a non-zero exit", async () => {
  const { PassThrough } = await import("node:stream");
  const stdin = new PassThrough();
  const stdout = sink();
  const stderr = sink();
  const pending = main([], { cwd: await tmp(), stdin, stdout, stderr, interactive: true });
  stdin.end();
  assert.equal(await pending, 1);
  assert.match(stderr.text, /Input ended/);
});
