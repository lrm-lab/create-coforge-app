import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const TEMPLATES_DIR = fileURLToPath(new URL("../templates/", import.meta.url));
export const DEFAULT_TEMPLATE = "pure-sign-in-web-app";

/**
 * @typedef {{ name: string, description: string, dir: string }} Template
 */

/**
 * Every directory under `templates/` is a template; its `template.json`
 * carries the one-line description shown by `--list-templates`.
 * @param {string} [root]
 * @returns {Promise<Template[]>}
 */
export async function listTemplates(root = TEMPLATES_DIR) {
  const entries = await readdir(root, { withFileTypes: true });
  const templates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const dir = join(root, entry.name);
    const meta = JSON.parse(await readFile(join(dir, "template.json"), "utf8"));
    templates.push({ name: entry.name, description: String(meta.description), dir });
  }
  return templates.sort((a, b) => a.name.localeCompare(b.name));
}
