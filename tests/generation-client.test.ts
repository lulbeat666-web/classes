import assert from 'node:assert/strict';
import test from 'node:test';
import {
  generateActivities,
  GenerationApiError,
  getProviderStatus,
  parseProviderBootstrap,
} from '../src/generation-client';
import { generationResponseSchema, type ProviderStatus } from '../src/shared/contracts';
import { demoLesson } from '../src/shared/demo-lesson';

const model = { id: 'gpt-4.1-mini-2025-04-14', label: 'GPT-4.1 mini' };
const demoStatus: ProviderStatus = {
  mode: 'demo',
  providers: [{ id: 'openai', label: 'OpenAI', available: false, models: [model] }],
};

function expectFailure(reason: GenerationApiError['reason'], message?: string) {
  return (error: unknown) => {
    assert.ok(error instanceof GenerationApiError);
    assert.equal(error.reason, reason);
    if (message !== undefined) assert.equal(error.message, message);
    return true;
  };
}

test('an available site in demo mode is distinct from a failed provider status check', async () => {
  const controller = new AbortController();
  const status = await getProviderStatus(controller.signal, async (input, init) => {
    assert.equal(input, '/api/providers');
    assert.equal(init?.signal, controller.signal);
    return Response.json(demoStatus);
  });
  assert.deepEqual(status, demoStatus);
});

test('embedded provider status is used only when it satisfies the shared schema', () => {
  const liveStatus: ProviderStatus = {
    mode: 'openai',
    providers: [{ id: 'openai', label: 'OpenAI', available: true, models: [model] }],
  };
  assert.deepEqual(parseProviderBootstrap(JSON.stringify(demoStatus)), demoStatus);
  assert.deepEqual(parseProviderBootstrap(JSON.stringify(liveStatus)), liveStatus);
  for (const absent of [null, undefined, '', '{', JSON.stringify({ ...demoStatus, mode: 'unknown' })]) {
    assert.equal(parseProviderBootstrap(absent), undefined);
  }
});

test('the fixed demo returns three validated 20-minute activities without a server', async () => {
  let requests = 0;
  const offline: typeof fetch = async () => {
    requests += 1;
    throw new TypeError('offline');
  };
  const result = await generateActivities(demoLesson, 'demo', undefined, offline);
  assert.deepEqual(generationResponseSchema.parse(result), result);
  assert.equal(result.mode, 'demo');
  assert.equal(result.activities.length, 3);
  assert.equal(new Set(result.activities.map(({ id }) => id)).size, 3);
  for (const { durationMinutes, steps } of result.activities) {
    assert.equal(durationMinutes, 20);
    assert.equal(steps.reduce((total, step) => total + step.durationMinutes, 0), 20);
  }

  const differentLesson = { ...demoLesson, objective: '두 문장의 공통점을 설명할 수 있다.' };
  await assert.rejects(generateActivities(differentLesson, 'demo', undefined, offline), expectFailure('invalid'));
  assert.equal(requests, 0);
});

test('an unauthorized request or manual login redirect is reported as a session error', async () => {
  const unauthorized: typeof fetch = async () => new Response('Authentication required', { status: 401 });
  await assert.rejects(getProviderStatus(undefined, unauthorized), expectFailure('session'));

  const login: typeof fetch = async (_input, init) => {
    assert.equal(init?.redirect, 'manual');
    return new Response(null, { status: 302, headers: { Location: '/login' } });
  };
  await assert.rejects(getProviderStatus(undefined, login), expectFailure('session'));
  await assert.rejects(generateActivities(demoLesson, 'openai', model.id, login), expectFailure('session'));
});

test('HTML in place of an API and a rejected connection are classified separately', async () => {
  for (const status of [200, 404]) {
    const html: typeof fetch = async () => new Response('<title>Creative Class AI</title>', {
      status,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
    await assert.rejects(getProviderStatus(undefined, html), expectFailure('routing'));
    await assert.rejects(generateActivities(demoLesson, 'openai', model.id, html), expectFailure('routing'));
  }

  const offline: typeof fetch = async () => { throw new TypeError('failed to fetch'); };
  await assert.rejects(getProviderStatus(undefined, offline), expectFailure('network'));
  await assert.rejects(generateActivities(demoLesson, 'openai', model.id, offline), expectFailure('network'));
});

test('a live 200 is validated and a live 503 retains the server message', async () => {
  const demo = await generateActivities(demoLesson, 'demo');
  const live = { ...demo, mode: 'openai' };
  const outcome = await generateActivities(demoLesson, 'openai', model.id, async (input, init) => {
    assert.equal(input, '/api/generate-activities');
    assert.equal(init?.method, 'POST');
    assert.deepEqual(JSON.parse(String(init?.body)), { lesson: demoLesson, mode: 'openai', model: model.id });
    return Response.json(live);
  });
  assert.deepEqual(outcome, live);
  await assert.rejects(
    generateActivities(demoLesson, 'openai', model.id, async () => Response.json(demo)),
    expectFailure('invalid'),
  );

  const message = 'OpenAI를 사용할 수 없습니다. 서버의 API 키, 생성 허용 및 접근 설정을 확인해 주세요.';
  const unavailable: typeof fetch = async () => Response.json({ error: { code: 'OPENAI_UNAVAILABLE', message } }, { status: 503 });
  await assert.rejects(generateActivities(demoLesson, 'openai', model.id, unavailable), expectFailure('server', message));
});
