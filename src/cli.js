import { readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { parseArgs } from "node:util";
import { scaffold } from "./scaffold.js";
import { DEFAULT_TEMPLATE, listTemplates } from "./templates.js";

const DEFAULT_DIR = "my-coforge-app";

const HELP = `Usage: create-coforge-app [dir] [options]

Scaffold an app for CoForge.

Options:
  -t, --template <name>   template to use (see --list-templates)
      --list-templates    print the available templates and exit
  -y, --yes               accept defaults instead of prompting
  -h, --help              show this help
  -v, --version           show the version
`;

/**
 * @param {string[]} argv
 * @param {{ cwd?: string, stdin?: NodeJS.ReadableStream, stdout?: NodeJS.WritableStream, stderr?: NodeJS.WritableStream, templatesDir?: string, interactive?: boolean }} [io]
 * @returns {Promise<number>} the process exit code
 */
export async function main(argv, io = {}) {
  const cwd = io.cwd ?? process.cwd();
  const stdout = io.stdout ?? process.stdout;
  const stderr = io.stderr ?? process.stderr;
  const out = (text) => stdout.write(`${text}\n`);

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        template: { type: "string", short: "t" },
        "list-templates": { type: "boolean" },
        yes: { type: "boolean", short: "y" },
        help: { type: "boolean", short: "h" },
        version: { type: "boolean", short: "v" },
      },
    });
  } catch (error) {
    stderr.write(`${error.message}\n\n${HELP}`);
    return 2;
  }
  const { values, positionals } = parsed;

  if (values.help) return out(HELP.trimEnd()), 0;
  if (values.version) {
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));
    return out(pkg.version), 0;
  }

  const templates = await listTemplates(io.templatesDir);
  if (values["list-templates"]) {
    for (const t of templates) out(`${t.name}\n  ${t.description}`);
    return 0;
  }
  if (positionals.length > 1) {
    stderr.write(`Expected at most one directory, got: ${positionals.join(" ")}\n`);
    return 2;
  }

  const interactive = io.interactive ?? Boolean(process.stdin.isTTY && process.stdout.isTTY);
  const prompts = !values.yes && interactive;
  let dir = positionals[0];
  let templateName = values.template;

  if (prompts && (!dir || !templateName)) {
    const rl = createInterface({ input: io.stdin ?? process.stdin, output: stdout });
    // readline's question() never settles if the input ends first; turn that into an error.
    const closed = new Promise((_, reject) =>
      rl.once("close", () => reject(new Error("Input ended before every question was answered."))),
    );
    closed.catch(() => {});
    const ask = (question) => Promise.race([rl.question(question), closed]);
    try {
      dir ??= (await ask(`Project directory (${DEFAULT_DIR}): `)).trim() || DEFAULT_DIR;
      if (!templateName) {
        templates.forEach((t, i) => out(`  ${i + 1}. ${t.name} - ${t.description}`));
        const answer = (await ask(`Template (${DEFAULT_TEMPLATE}): `)).trim();
        templateName = templates[Number(answer) - 1]?.name ?? (answer || DEFAULT_TEMPLATE);
      }
    } catch (error) {
      stderr.write(`${error.message}\n`);
      return 1;
    } finally {
      rl.close();
    }
  } else if (!dir && !values.yes) {
    stderr.write("No directory given and no terminal to ask on. Pass a directory, or --yes.\n");
    return 2;
  }
  dir ??= DEFAULT_DIR;
  templateName ??= DEFAULT_TEMPLATE;

  const template = templates.find((t) => t.name === templateName);
  if (!template) {
    stderr.write(
      `Unknown template "${templateName}". Available: ${templates.map((t) => t.name).join(", ")}\n`,
    );
    return 2;
  }

  let result;
  try {
    result = await scaffold({ templateDir: template.dir, targetDir: resolve(cwd, dir) });
  } catch (error) {
    stderr.write(`${error.message}\n`);
    return 1;
  }

  const shown = relative(cwd, result.targetDir) || ".";
  out(`\nCreated ${result.appName} from ${template.name} in ${result.targetDir}\n`);
  out("Next steps:");
  if (shown !== ".") out(`  cd ${shown}`);
  out("  npm install        (or: bun install)");
  out("  cp .env.example .env");
  out("  read README.md for the CoForge registration steps and the environment variables");
  out("  npm test");
  return 0;
}
