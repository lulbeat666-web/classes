import assert from 'node:assert/strict';
import test from 'node:test';
import { exportJWK, generateKeyPair, SignJWT } from 'jose';
import { createGenerateHandler } from '../functions/api/generate-activities';
import { demoActivities, demoGeneration } from '../src/shared/demo-activities';
import { validateActivities } from '../functions/lib/validation';
import { demoLesson, isDemoLesson } from '../src/shared/demo-lesson';

const publicModel = 'gpt-4.1-mini-2025-04-14';
const liveEnv = { ENABLE_LIVE_GENERATION: 'true', OPENAI_API_KEY: 'test-only-key' };
const livePayload = { mode: 'openai', model: publicModel, lesson: demoLesson };

function post(body: unknown, url = 'http://localhost:8788/api/generate-activities', headers: Record<string, string> = {}) {
  return new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

function upstreamResponse(value: unknown) {
  return Response.json({
    status: 'completed',
    output: [{
      type: 'message',
      role: 'assistant',
      content: [{ type: 'output_text', text: JSON.stringify(value) }],
    }],
  });
}

async function assertApiError(response: Response, status: number, code: string) {
  assert.equal(response.status, status, await response.clone().text());
  const body = await response.json() as { error: { code: string; message: string } };
  assert.equal(body.error.code, code);
  assert.ok(body.error.message.trim());
}

test('the fixture uses three distinct activities and meets the §9 contract', () => {
  assert.equal(demoGeneration.mode, 'demo');
  assert.doesNotThrow(() => validateActivities({ activities: demoGeneration.activities }, demoLesson));
  assert.equal(demoActivities.length, 3);
  assert.equal(new Set(demoActivities.map((activity) => activity.title)).size, 3);
  for (const activity of demoActivities) {
    const stepMinutes = activity.steps.reduce((sum, step) => sum + step.durationMinutes, 0);
    assert.equal(stepMinutes, activity.durationMinutes);
    assert.equal(stepMinutes, demoLesson.durationMinutes);
    assert.ok(activity.preparationMinutes <= demoLesson.preparationMinutes);
    assert.deepEqual(activity.steps.map((step) => step.order), activity.steps.map((_step, index) => index + 1));
  }
});

test('only the canonical demo lesson matches after input normalization', () => {
  assert.ok(isDemoLesson(demoLesson));
  assert.ok(isDemoLesson({
    ...demoLesson,
    objective: ` ${demoLesson.objective} \n`,
    textbookContent: ` ${demoLesson.textbookContent} \n`,
    mechanisms: [...demoLesson.mechanisms].reverse(),
  }));
  assert.equal(isDemoLesson({ ...demoLesson, durationMinutes: 25 }), false);
  assert.equal(isDemoLesson({ ...demoLesson, durationMinutes: 12 }), false);
  assert.equal(isDemoLesson({ ...demoLesson, objective: ' ' }), false);
});

test('semantic validation rejects inconsistent time, duplicate activities, preparation time and scores', () => {
  const [first, second, third] = demoActivities;
  assert.ok(first && second && third);
  const editedFirstActivities = [
    { ...first, durationMinutes: first.durationMinutes + 1 },
    { ...first, preparationMinutes: demoLesson.preparationMinutes + 1 },
    { ...first, qualityScores: { ...first.qualityScores, feasibility: 6 } },
    { ...first, steps: first.steps.map((step, index) => index === 0 ? { ...step, order: 2 } : step) },
    { ...first, excludedMechanisms: [] },
    { ...first, learningObjective: '다른 학습 목표' },
    { ...first, materials: ['허용되지 않은 준비물'] },
  ];
  for (const edited of editedFirstActivities) {
    assert.throws(() => validateActivities({ activities: [edited, second, third] }, demoLesson));
  }
  assert.throws(() => validateActivities({ activities: [first, first, third] }, demoLesson));
  assert.throws(() => validateActivities({ activities: [first, second] }, demoLesson));
  assert.throws(() => validateActivities({ activities: demoActivities }, { ...demoLesson, materials: 'none' }));
  assert.throws(() => validateActivities({ activities: demoActivities }, { ...demoLesson, durationMode: 'max', durationMinutes: 15 }));
  assert.doesNotThrow(() => validateActivities({ activities: demoActivities }, { ...demoLesson, durationMode: 'max', durationMinutes: 25 }));
});

test('provider null values are normalized to optional fields for the UI', () => {
  const [first, ...others] = demoActivities;
  assert.ok(first);
  const steps = first.steps.map((step, index) => index === 0 ? { ...step, teacherScript: null } : step);
  const result = validateActivities({ activities: [{ ...first, steps }, ...others] }, demoLesson);
  assert.ok(result[0]?.steps[0]);
  assert.equal('teacherScript' in result[0].steps[0], false);
});

test('the OpenAI adapter submits a server-authenticated strict Responses API request', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input, init) => {
    calls += 1;
    const request = new Request(input, init);
    assert.equal(request.url, 'https://api.openai.com/v1/responses');
    assert.equal(request.headers.get('Authorization'), `Bearer ${liveEnv.OPENAI_API_KEY}`);
    const body = await request.json() as {
      model: string;
      text: { format: { type: string; strict: boolean; schema: Record<string, unknown> } };
    };
    assert.equal(body.model, publicModel);
    assert.equal(body.text.format.type, 'json_schema');
    assert.equal(body.text.format.strict, true);
    assert.equal(body.text.format.schema.type, 'object');
    assert.match(JSON.stringify(body), /분수의 나눗셈 원리를 설명할 수 있다/);
    return upstreamResponse({ activities: demoActivities });
  };
  const response = await createGenerateHandler({ fetcher })({ request: post(livePayload), env: liveEnv });
  assert.equal(response.status, 200, await response.clone().text());
  const data = await response.json() as { mode: string; activities: unknown[] };
  assert.equal(data.mode, 'openai');
  assert.equal(data.activities.length, 3);
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(data), /test-only-key/);
});

test('only one repair is attempted for an invalid reply', async () => {
  const successfulRepair: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    successfulRepair.push(await new Request(input, init).text());
    const activities = successfulRepair.length === 1 ? [] : demoActivities;
    return upstreamResponse({ activities });
  };
  const repaired = await createGenerateHandler({ fetcher })({ request: post(livePayload), env: liveEnv });
  assert.equal(repaired.status, 200, await repaired.clone().text());
  assert.equal(successfulRepair.length, 2);
  assert.notEqual(successfulRepair[0], successfulRepair[1]);

  let invalidReplies = 0;
  const repeatedlyInvalid = createGenerateHandler({ fetcher: async () => {
    invalidReplies += 1;
    return upstreamResponse({ activities: [] });
  } });
  await assertApiError(await repeatedlyInvalid({ request: post(livePayload), env: liveEnv }), 502, 'INVALID_AI_RESPONSE');
  assert.equal(invalidReplies, 2);
});

test('provider rate limits, other HTTP errors and timeouts are translated without a repair', async (t) => {
  for (const [upstreamStatus, localStatus, code] of [
    [429, 429, 'PROVIDER_RATE_LIMITED'],
    [401, 502, 'PROVIDER_ERROR'],
    [500, 502, 'PROVIDER_ERROR'],
  ] as const) {
    await t.test(String(upstreamStatus), async () => {
      let calls = 0;
      const handler = createGenerateHandler({ fetcher: async () => {
        calls += 1;
        return new Response('upstream details', { status: upstreamStatus });
      } });
      const response = await handler({ request: post(livePayload), env: liveEnv });
      assert.doesNotMatch(await response.clone().text(), /upstream details/);
      await assertApiError(response, localStatus, code);
      assert.equal(calls, 1);
    });
  }
  await t.test('timeout', async () => {
    let calls = 0;
    const fetcher: typeof fetch = async (_input, init) => {
      calls += 1;
      return new Promise<Response>((_resolve, reject) => {
        assert.ok(init?.signal);
        init.signal.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
      });
    };
    const handler = createGenerateHandler({ fetcher, timeoutMs: 100 });
    await assertApiError(await handler({ request: post(livePayload), env: liveEnv }), 504, 'PROVIDER_TIMEOUT');
    assert.equal(calls, 1);
  });
});

test('rejects unauthorized, malformed, oversized and unsupported requests before contacting the provider', async () => {
  const handler = createGenerateHandler({ fetcher: async () => { assert.fail('provider was contacted'); } });
  await assertApiError(await handler({ request: post(livePayload), env: {} }), 503, 'OPENAI_UNAVAILABLE');
  await assertApiError(await handler({ request: post(livePayload, 'https://school.example/api/generate-activities'), env: liveEnv }), 503, 'OPENAI_UNAVAILABLE');
  await assertApiError(await handler({ request: post(livePayload, undefined, { Origin: 'https://unrelated.example' }), env: liveEnv }), 403, 'ORIGIN_DENIED');
  await assertApiError(await handler({ request: post({ ...livePayload, model: 'unknown-model' }), env: liveEnv }), 400, 'UNSUPPORTED_MODEL');
  await assertApiError(await handler({ request: post({ ...livePayload, lesson: { ...demoLesson, objective: ' ' } }), env: liveEnv }), 400, 'INVALID_INPUT');
  await assertApiError(await handler({ request: post({ ...livePayload, lesson: { ...demoLesson, mechanisms: ['random', 'movement', 'craft', 'exchange', 'challenge'] } }), env: liveEnv }), 400, 'INVALID_INPUT');
  await assertApiError(await handler({ request: post(livePayload, undefined, { 'Content-Type': 'text/plain' }), env: liveEnv }), 415, 'UNSUPPORTED_MEDIA_TYPE');
  await assertApiError(await handler({ request: post({ data: 'a'.repeat(100_000) }), env: liveEnv }), 413, 'REQUEST_TOO_LARGE');
  const malformed = new Request('http://localhost:8788/api/generate-activities', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{',
  });
  await assertApiError(await handler({ request: malformed, env: liveEnv }), 400, 'INVALID_JSON');
});

test('production access admits signed tokens scoped to the configured audience', async (t) => {
  const issuer = 'https://class-ai-test.cloudflareaccess.com';
  const audience = 'class-ai-test-audience';
  const kid = 'test-signing-key';
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = await exportJWK(publicKey);
  const keyFetch = t.mock.method(globalThis, 'fetch', async (input: URL | Request | string) => {
    assert.equal(String(input), issuer + '/cdn-cgi/access/certs');
    return Response.json({ keys: [{ ...jwk, kid, alg: 'RS256' }] });
  });
  const env = { ...liveEnv, LIVE_ACCESS_TEAM_DOMAIN: issuer, LIVE_ACCESS_AUDIENCE: audience };
  const token = (targetAudience: string) => new SignJWT({})
    .setProtectedHeader({ alg: 'RS256', kid })
    .setIssuer(issuer)
    .setSubject('class-ai-test-teacher')
    .setAudience(targetAudience)
    .setExpirationTime('2m')
    .sign(privateKey);
  let providerCalls = 0;
  const handler = createGenerateHandler({ fetcher: async () => {
    providerCalls += 1;
    return upstreamResponse({ activities: demoActivities });
  } });
  const endpoint = 'https://school.example/api/generate-activities';
  async function generate(targetAudience: string) {
    return handler({ request: post(livePayload, endpoint, { 'Cf-Access-Jwt-Assertion': await token(targetAudience) }), env });
  }
  await assertApiError(await generate('unrelated-audience'), 503, 'OPENAI_UNAVAILABLE');
  const authorized = await generate(audience);
  assert.equal(authorized.status, 200, await authorized.clone().text());
  assert.equal(providerCalls, 1);
  assert.equal(keyFetch.mock.callCount(), 1);
});
