import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const GATES = [
  { name: 'boundary-check', script: 'scripts/verify-public-boundary.mjs' },
  { name: 'security-audit', script: 'scripts/audit-public-shell.mjs' },
  { name: 'unit-tests', script: 'npm test', isNpm: true },
  { name: 'stage-artifact', script: 'scripts/stage-public-artifact.mjs' },
  { name: 'leak-scan', script: 'scripts/scan-deployment-artifact.mjs .stage-public' },
];

async function runGate(name, script, isNpm = false) {
  return new Promise((resolve) => {
    const [cmd, ...args] = isNpm
      ? ['npm', 'test']
      : ['node', script];

    // For npm commands, use npm directly
    const child = isNpm
      ? spawn('npm', ['test'], { cwd: ROOT, stdio: 'pipe', shell: true })
      : spawn('node', script.split(' '), { cwd: ROOT, stdio: 'pipe', shell: true });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (d) => { stdout += d.toString(); });
    child.stderr.on('data', (d) => { stderr += d.toString(); });

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`GATE_PASS: ${name}`);
      } else {
        console.error(`GATE_FAIL: ${name} (exit ${code})`);
      }
      resolve(code === 0);
    });

    child.on('error', (err) => {
      console.error(`GATE_ERROR: ${name}`);
      resolve(false);
    });
  });
}

async function main() {
  let passed = 0;
  let failed = 0;

  for (const gate of GATES) {
    const ok = await runGate(gate.name, gate.script, gate.isNpm);
    if (ok) {
      passed += 1;
    } else {
      failed += 1;
    }
  }

  console.log(`RELEASE_GATES: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
  console.log('RELEASE_READY');
}

main();
