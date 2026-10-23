import { cp, mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { basename, join, resolve } from "node:path";

/** Files that npm (or git) would rewrite or drop if shipped under their real name. */
const RENAMES = { _gitignore: ".gitignore", _npmrc: ".npmrc" };
const SKIPPED = new Set(["node_modules", "template.json"]);

/**
 * Turn a directory name into a valid unscoped npm package name.
 * @param {string} dirName
 */
export function toPackageName(dirName) {
  const name = dirName
    .toLowerCase()
    .replace(/[^a-z0-9._~-]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "");
  return name.slice(0, 214) || "coforge-app";
}

/**
 * Copy a template into `targetDir` and fill the placeholders.
 * Refuses a target directory that already has content.
 * @param {{ templateDir: string, targetDir: string }} options
 * @returns {Promise<{ appName: string, packageName: string, targetDir: string }>}
 */
export async function scaffold({ templateDir, targetDir }) {
  const target = resolve(targetDir);
  const existed = await assertEmptyOrMissing(target);
  await mkdir(target, { recursive: true });
  try {
    await cp(templateDir, target, {
      recursive: true,
      filter: (source) => !SKIPPED.has(basename(source)),
    });
    return await finish(target);
  } catch (error) {
    // Leave nothing half-copied behind: remove what we made, or empty the directory we were given.
    if (existed) {
      for (const name of await readdir(target)) await rm(join(target, name), { recursive: true, force: true });
    } else {
      await rm(target, { recursive: true, force: true });
    }
    throw error;
  }
}

/** @param {string} target */
async function finish(target) {
  // The name lands inside source files, so keep it to plain characters.
  const appName = basename(target).replace(/[^\w .-]+/g, "-") || "coforge-app";
  const packageName = toPackageName(basename(target));
  const values = { __APP_NAME__: appName, __PACKAGE_NAME__: packageName };
  await fillPlaceholders(target, values);
  return { appName, packageName, targetDir: target };
}

/**
 * @param {string} target
 * @returns {Promise<boolean>} whether the (empty) directory already existed
 */
async function assertEmptyOrMissing(target) {
  let info;
  try {
    info = await stat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
  if (!info.isDirectory()) throw new Error(`${target} exists and is not a directory`);
  if ((await readdir(target)).length > 0) {
    throw new Error(`${target} is not empty; choose an empty or new directory`);
  }
  return true;
}

/**
 * @param {string} dir
 * @param {Record<string, string>} values
 */
async function fillPlaceholders(dir, values) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    let path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await fillPlaceholders(path, values);
      continue;
    }
    const text = await readFile(path, "utf8");
    let next = text;
    for (const [placeholder, value] of Object.entries(values)) {
      next = next.split(placeholder).join(value);
    }
    if (next !== text) await writeFile(path, next);
    const renamed = RENAMES[entry.name];
    if (renamed) await rename(path, join(dir, renamed));
  }
}
