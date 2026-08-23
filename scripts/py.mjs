// Cross-platform Python launcher for apps/api.
// The venv interpreter lives in .venv/Scripts on Windows and .venv/bin
// elsewhere, and `python3` is not a command on Windows.
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);

const systemPython = () => (process.platform === "win32" ? "python" : "python3");

const venvPython = () => {
  const candidates = [".venv/Scripts/python.exe", ".venv/bin/python"];
  const found = candidates.find((p) => existsSync(p));
  if (!found) {
    console.error("No virtualenv in apps/api/.venv — run `pnpm setup:api` first.");
    process.exit(1);
  }
  return found;
};

const run = (cmd, cmdArgs) =>
  new Promise((resolve) => {
    spawn(cmd, cmdArgs, { stdio: "inherit" }).on("exit", (code) => {
      if (code) process.exit(code);
      resolve();
    });
  });

if (args[0] === "--setup") {
  await run(systemPython(), ["-m", "venv", ".venv"]);
  await run(venvPython(), ["-m", "pip", "install", "--quiet", "--upgrade", "pip"]);
  await run(venvPython(), ["-m", "pip", "install", "--quiet", "-e", ".[dev]"]);
} else {
  const resolved = args.map((a) => {
    const m = /^\$\{(\w+):-(.*)\}$/.exec(a);
    return m ? process.env[m[1]] || m[2] : a;
  });
  await run(venvPython(), resolved);
}
