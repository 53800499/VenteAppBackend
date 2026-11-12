const { spawn, execSync } = require('child_process');
const path = require('path');

const backendRoot = path.resolve(__dirname, '..');

// 1. Build initial propre pour garantir que dist/main.js existe
execSync('npx nest build', { cwd: backendRoot, stdio: 'inherit' });

// 2. Watch TypeScript + Node 22 --watch (évite le bug Windows taskkill /T /F de @nestjs/cli)
const tsc = spawn(
  process.platform === 'win32' ? 'npx.cmd' : 'npx',
  ['tsc', '-p', 'tsconfig.build.json', '--watch', '--preserveWatchOutput'],
  { cwd: backendRoot, stdio: 'inherit', shell: process.platform === 'win32' },
);

const server = spawn(
  process.execPath,
  ['--watch', 'dist/main.js'],
  { cwd: backendRoot, stdio: 'inherit' },
);

function shutdown() {
  try { tsc.kill(); } catch (_) {}
  try { server.kill(); } catch (_) {}
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

server.on('exit', (code) => {
  try { tsc.kill(); } catch (_) {}
  process.exit(code ?? 0);
});

