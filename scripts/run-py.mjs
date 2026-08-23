// Hands a `pnpm <script>` straight to run.py, which is the real entry point.
//
// package.json scripts go through cmd.exe on Windows and sh elsewhere, and the
// interpreter is spelled differently on each: `py -3` or `python` on Windows,
// `python3` almost everywhere else. Resolving it here keeps one spelling in
// package.json instead of a shell idiom that only works on one platform.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// PYTHON=/path/to/python (or PYTHON="py -3.13") wins, for machines where the
// default interpreter is newer than the wheels the backend depends on.
const override = process.env.PYTHON?.trim();

const candidates = override
  ? [[override.split(/\s+/)[0], override.split(/\s+/).slice(1)]]
  : process.platform === "win32"
    ? [["py", ["-3"]], ["python", []], ["python3", []]]
    : [["python3", []], ["python", []]];

const interpreter = candidates.find(([cmd, args]) => {
  const probe = spawnSync(cmd, [...args, "--version"], { stdio: "ignore" });
  return probe.status === 0;
});

if (!interpreter) {
  console.error("No Python 3 found on PATH. Install Python 3.11+ and try again.");
  process.exit(1);
}

const [cmd, prefix] = interpreter;

spawn(cmd, [...prefix, path.join(root, "run.py"), ...process.argv.slice(2)], {
  cwd: root,
  stdio: "inherit",
}).on("exit", (code) => process.exit(code ?? 1));
