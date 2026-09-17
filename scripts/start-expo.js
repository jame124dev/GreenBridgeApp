#!/usr/bin/env node
/**
 * Expo/Metro launcher with two guards:
 *
 * 1. Heap cap. nativewind@4 forks its Tailwind worker
 *    (node_modules/nativewind/dist/metro/tailwind/v3/index.js) with
 *    `env: { ...process.env }`, so NODE_OPTIONS set here is inherited by the
 *    child that leaks. Left uncapped the worker grows past 6 GB and burns
 *    ~35% CPU in V8 GC thrash before it OOMs and respawns. Recycling it at
 *    ~2 GB keeps it out of that spiral.
 *
 * 2. Single instance. Two Metro file watchers on Windows cost far more than
 *    twice one watcher, so refuse to start if the port is already taken.
 *
 * Override the cap with EXPO_HEAP_MB. Args are passed through to `expo start`.
 */
const { spawn } = require('child_process');
const net = require('net');
const path = require('path');
const fs = require('fs');

const EXPO_CLI = path.join(__dirname, '..', 'node_modules', 'expo', 'bin', 'cli');

const HEAP_MB = process.env.EXPO_HEAP_MB || '2048';
const args = process.argv.slice(2);

const portFlag = args.indexOf('--port');
const PORT = Number(
  portFlag !== -1 ? args[portFlag + 1] : process.env.RCT_METRO_PORT || 8081,
);

// Probe by connecting, not by binding: Windows happily lets a fresh
// 127.0.0.1 bind sit alongside Metro's existing 0.0.0.0 bind, so a bind test
// reports "free" while Metro is plainly running. A successful connect does not.
function portInUse(port) {
  return new Promise((resolve) => {
    const sock = new net.Socket();
    const done = (inUse) => {
      sock.destroy();
      resolve(inUse);
    };
    sock.setTimeout(1000);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(false));
    sock.once('error', () => done(false));
    sock.connect(port, '127.0.0.1');
  });
}

(async () => {
  if (!fs.existsSync(EXPO_CLI)) {
    console.error(`
  Expo CLI not found at ${EXPO_CLI} — run npm install.
`);
    process.exit(1);
  }

  if (await portInUse(PORT)) {
    console.error(
      `\n  Metro is already running on port ${PORT}.\n` +
        `  Reuse that one, or stop it first. Running two watchers pins the CPU.\n`,
    );
    process.exit(1);
  }

  const nodeOptions = [process.env.NODE_OPTIONS, `--max-old-space-size=${HEAP_MB}`]
    .filter(Boolean)
    .join(' ');

  console.log(`  Metro on :${PORT} — Tailwind worker heap capped at ${HEAP_MB} MB\n`);

  // Run Expo's CLI with this same node binary. Going through npx would mean
  // spawning npx.cmd, which Node refuses without shell:true (EINVAL), and
  // shell:true in turn trips DEP0190.
  const child = spawn(process.execPath, [EXPO_CLI, 'start', ...args], {
    stdio: 'inherit',
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
  });

  child.on('exit', (code, signal) => process.exit(signal ? 1 : code ?? 0));
})();
