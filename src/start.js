
import { spawn } from 'node:child_process';

const processes = [
  spawn(process.execPath, ['src/server.js'], { stdio: 'inherit' }),
  spawn(process.execPath, ['src/workers/webhook.worker.js'], { stdio: 'inherit' }),
];

for (const child of processes) {
  child.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      console.error(`Process exited with code ${code}`);
      for (const processChild of processes) {
        if (processChild !== child) processChild.kill();
      }
      process.exitCode = code;
    }
  });
}

function shutdown() {
  for (const child of processes) {
    if (!child.killed) child.kill('SIGTERM');
  }
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
