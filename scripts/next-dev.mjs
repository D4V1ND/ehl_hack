// Cross-platform `next dev --port` launcher.
// package.json scripts run through cmd.exe on Windows, where POSIX
// ${WEB_PORT:-3000} is passed through literally instead of expanded.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";

const [varName, fallback] = process.argv.slice(2);
const port = process.env[varName] || fallback;

// Resolve next's own entrypoint so we can run it with this node binary,
// rather than relying on the platform's .bin shim.
const require = createRequire(path.join(process.cwd(), "package.json"));
const manifest = require.resolve("next/package.json");
const bin = JSON.parse(readFileSync(manifest, "utf8")).bin.next;
const entry = path.join(path.dirname(manifest), bin);

spawn(process.execPath, [entry, "dev", "--port", port], {
  stdio: "inherit",
}).on("exit", (code) => process.exit(code ?? 1));
