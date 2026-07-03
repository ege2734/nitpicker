#!/usr/bin/env -S npx tsx
// nitpicker CLI — dev-only tooling entrypoint. Subcommands:
//   nitpicker serve                     start the sidecar transport server
//   nitpicker poll --session <id>       long-poll for the next feedback batch (the agent runs this)
//   nitpicker health [--endpoint <url>] check the sidecar is up
//   nitpicker shutdown [--endpoint …]   stop the sidecar
//   nitpicker verify [--dir <path>]     fail if nitpicker leaked into a build (default .next)
//
// Run via `npx tsx nitpicker/bin/nitpicker.ts <cmd>` or the package.json `nitpicker:*` scripts.
import { spawn } from "node:child_process";
import { get, request } from "node:http";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { runPoll } from "../cli/poll";
import { runVerify } from "../cli/verify";

const HERE = dirname(fileURLToPath(import.meta.url));
const DEFAULT_ENDPOINT = process.env.NITPICKER_ENDPOINT || "http://127.0.0.1:5178";

function flag(args: string[], name: string): string | undefined {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
}
function has(args: string[], name: string): boolean {
  return args.includes(`--${name}`);
}

function serve(): void {
  // Run the server module under the same tsx runtime as a child, forwarding its stdio.
  const server = join(HERE, "..", "server", "index.ts");
  const proc = spawn("npx", ["tsx", server], { stdio: "inherit" });
  proc.on("exit", (code) => process.exit(code ?? 0));
}

function ping(endpoint: string, path: string, method: "GET" | "POST"): Promise<string> {
  const u = new URL(path, endpoint);
  return new Promise((resolve, reject) => {
    const cb = (res: import("node:http").IncomingMessage): void => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => resolve(body));
    };
    const req = method === "GET" ? get(u, cb) : request(u, { method }, cb);
    req.on("error", reject);
    if (method === "POST") req.end();
  });
}

async function main(): Promise<void> {
  const [cmd, ...rest] = process.argv.slice(2);
  const endpoint = flag(rest, "endpoint") || DEFAULT_ENDPOINT;

  switch (cmd) {
    case "serve":
      return serve();
    case "poll": {
      const session = flag(rest, "session");
      if (!session) {
        process.stderr.write("usage: nitpicker poll --session <id> [--endpoint <url>] [--watch]\n");
        process.exit(1);
      }
      return runPoll({
        session,
        endpoint,
        timeoutMs: Number(flag(rest, "timeoutMs")) || 0,
        watch: has(rest, "watch"),
      });
    }
    case "health":
      process.stdout.write((await ping(endpoint, "/health", "GET")) + "\n");
      return;
    case "shutdown":
      process.stdout.write((await ping(endpoint, "/shutdown", "POST")) + "\n");
      return;
    case "verify":
      // Prod-leak guard: nonzero exit fails the build/CI if nitpicker slipped into the output.
      process.exit(runVerify({ dir: flag(rest, "dir") || ".next" }));
      return;
    default:
      process.stderr.write(
        "usage: nitpicker <serve|poll|health|shutdown|verify> [--endpoint <url>] [--dir <path>]\n",
      );
      process.exit(1);
  }
}

void main();
