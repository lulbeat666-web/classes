import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, symlink } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { demoLesson } from '../src/shared/demo-lesson';

const source = fileURLToPath(new URL('../', import.meta.url));

async function openPort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  return address.port;
}

function sendSignal(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) return;
  if (process.platform === 'win32') {
    child.kill(signal);
    return;
  }
  try {
    process.kill(-child.pid, signal);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
  }
}

async function waitForApi(origin: string, child: ChildProcess, startupLog: () => string) {
  const deadline = Date.now() + 25_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) break;
    try {
      const response = await fetch(`${origin}/api/providers`, { signal: AbortSignal.timeout(500) });
      if (response.ok && response.headers.get('Content-Type')?.includes('application/json')) return;
    } catch {
      // Wrangler may still be compiling or starting workerd.
    }
    await delay(100);
  }
  assert.fail(`Cloudflare Pages API did not start.\n${startupLog()}`);
}

test('Wrangler Pages serves the built React app and real API routes without any credentials', { timeout: 60_000 }, async (t) => {
  const workerDirectory = await mkdtemp(join(tmpdir(), 'class-ai-pages-'));
  let child: ChildProcess | undefined;
  t.after(async () => {
    if (child) {
      sendSignal(child, 'SIGTERM');
      await delay(300);
      sendSignal(child, 'SIGKILL');
    }
    await rm(workerDirectory, { recursive: true, force: true });
  });
  await Promise.all([
    cp(join(source, 'dist'), join(workerDirectory, 'dist'), { recursive: true }),
    cp(join(source, 'functions'), join(workerDirectory, 'functions'), { recursive: true }),
    cp(join(source, 'src', 'shared'), join(workerDirectory, 'src', 'shared'), { recursive: true }),
    cp(join(source, 'wrangler.jsonc'), join(workerDirectory, 'wrangler.jsonc')),
    symlink(join(source, 'node_modules'), join(workerDirectory, 'node_modules'), 'junction'),
    mkdir(join(workerDirectory, 'config')),
  ]);

  const port = await openPort();
  const origin = `http://127.0.0.1:${port}`;
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    XDG_CONFIG_HOME: join(workerDirectory, 'config'),
    WRANGLER_SEND_METRICS: 'false',
    WRANGLER_LOG_PATH: join(workerDirectory, 'wrangler.log'),
    CLOUDFLARE_INCLUDE_PROCESS_ENV: 'false',
    CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
  };
  delete env.OPENAI_API_KEY;
  delete env.ENABLE_LIVE_GENERATION;
  delete env.LIVE_ACCESS_TEAM_DOMAIN;
  delete env.LIVE_ACCESS_AUDIENCE;
  const worker = spawn(process.execPath, [
    join(source, 'node_modules', 'wrangler', 'bin', 'wrangler.js'),
    'pages', 'dev', 'dist', '--ip', '127.0.0.1', '--port', String(port),
    '--inspector-port', '0',
  ], {
    cwd: workerDirectory,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.platform !== 'win32',
  });
  child = worker;
  let startupLog = '';
  worker.on('error', (error) => { startupLog += `\n${error.message}`; });
  worker.stdout.on('data', (data: Buffer) => { startupLog += data.toString(); });
  worker.stderr.on('data', (data: Buffer) => { startupLog += data.toString(); });
  await waitForApi(origin, worker, () => startupLog);

  const frontend = await fetch(origin);
  assert.equal(frontend.status, 200);
  assert.match(await frontend.text(), /Creative Class AI/);

  const providers = await fetch(`${origin}/api/providers`);
  assert.equal(providers.status, 200);
  const providerState = await providers.json() as {
    mode: string;
    providers: { id: string; available: boolean }[];
  };
  assert.equal(providerState.mode, 'demo');
  assert.equal(providerState.providers.find((provider) => provider.id === 'openai')?.available, false);

  function generate(body: unknown) {
    return fetch(`${origin}/api/generate-activities`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: origin },
      body: JSON.stringify(body),
    });
  }
  const demo = await generate({ mode: 'demo', lesson: demoLesson });
  assert.equal(demo.status, 200, await demo.clone().text());
  const demoResult = await demo.json() as {
    mode: string;
    activities: { title: string; durationMinutes: number; steps: { durationMinutes: number }[] }[];
  };
  assert.equal(demoResult.mode, 'demo');
  assert.equal(demoResult.activities.length, 3);
  assert.equal(new Set(demoResult.activities.map((activity) => activity.title)).size, 3);
  for (const activity of demoResult.activities) {
    assert.equal(activity.durationMinutes, demoLesson.durationMinutes);
    assert.equal(activity.steps.reduce((sum, step) => sum + step.durationMinutes, 0), activity.durationMinutes);
  }

  const changedDemoInput = await generate({ mode: 'demo', lesson: { ...demoLesson, durationMinutes: 25 } });
  assert.equal(changedDemoInput.status, 400);
  assert.match(await changedDemoInput.text(), /DEMO_INPUT_MISMATCH/);
  const invalid = await generate({ mode: 'demo', lesson: { ...demoLesson, objective: '' } });
  assert.equal(invalid.status, 400);
  assert.match(await invalid.text(), /INVALID_INPUT/);
  const unavailable = await generate({ mode: 'openai', lesson: demoLesson });
  assert.equal(unavailable.status, 503);
  assert.match(await unavailable.text(), /OPENAI_UNAVAILABLE/);
});
