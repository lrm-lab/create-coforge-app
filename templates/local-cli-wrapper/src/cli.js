#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { lstatSync, mkdirSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, join, parse, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const help = "Usage: __COMMAND_NAME__ summarize <text>";
const demo = fileURLToPath(new URL("./demo-tool.js", import.meta.url));

function privateDirectory(path) {
  mkdirSync(path, { mode: 0o700, recursive: true });
  const info = lstatSync(path);
  if (!info.isDirectory() || (process.getuid && (info.uid !== process.getuid() || (info.mode & 0o077)))) {
    throw new Error("The configured Agent storage must be a private directory owned by the current user.");
  }
  return realpathSync(path);
}

function localEnvironment() {
  const base = process.env.COFORGE_LOCAL_CLI_HOME;
  if (!base || !isAbsolute(base)) throw new Error("Set COFORGE_LOCAL_CLI_HOME to an absolute path for this Agent.");
  const hostHome = realpathSync(homedir());
  const root = privateDirectory(base);
  const toHome = relative(root, hostHome);
  if (root === parse(root).root || !toHome || (!isAbsolute(toHome) && toHome !== ".." && !toHome.startsWith(`..${sep}`))) {
    throw new Error("Use dedicated Agent storage outside the user's home paths used by the tool.");
  }
  const storage = privateDirectory(join(root, "__COMMAND_NAME__"));
  const env = {
    HOME: storage,
    USERPROFILE: storage,
    XDG_CONFIG_HOME: privateDirectory(join(storage, "config")),
    XDG_CACHE_HOME: privateDirectory(join(storage, "cache")),
    XDG_DATA_HOME: privateDirectory(join(storage, "data")),
    XDG_STATE_HOME: privateDirectory(join(storage, "state")),
    TMPDIR: privateDirectory(join(storage, "tmp")),
  };
  env.APPDATA = env.XDG_CONFIG_HOME;
  env.LOCALAPPDATA = env.XDG_DATA_HOME;
  env.TEMP = env.TMP = env.TMPDIR;
  return { cwd: storage, env };
}

function run(args) {
  if (args.length === 1 && ["-h", "--help"].includes(args[0])) {
    console.log(help);
    return 0;
  }
  if (args.length !== 2 || args[0] !== "summarize" || args[1].length > 4096) {
    console.error(help);
    return 2;
  }
  let options;
  try {
    options = localEnvironment();
  } catch (error) {
    console.error(error.message);
    return 1;
  }
  const result = spawnSync(process.execPath, [demo, args[1]], {
    ...options,
    stdio: ["ignore", "inherit", "inherit"],
    timeout: 10_000,
    killSignal: "SIGKILL",
    windowsHide: true,
  });
  if (result.error) {
    console.error(result.error.code === "ETIMEDOUT" ? "Wrapped command timed out." : "Could not start wrapped command.");
    return result.error.code === "ETIMEDOUT" ? 124 : 1;
  }
  return result.status ?? 1;
}

process.exitCode = run(process.argv.slice(2));
