import assert from 'node:assert/strict';
import test from 'node:test';
import generateActivities, { config as generationRoute } from '../netlify/functions/generate-activities';
import providers, { config as providersRoute } from '../netlify/functions/providers';
import { generationResponseSchema, providerStatusSchema } from '../src/shared/contracts';
import { demoActivities } from '../src/shared/demo-activities';
import { demoLesson } from '../src/shared/demo-lesson';

const site = 'https://school.netlify.app';

function post(mode: 'demo' | 'openai', headers: Record<string, string> = {}) {
  return new Request(site + generationRoute.path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: site, ...headers },
    body: JSON.stringify({ mode, lesson: demoLesson }),
  });
}

test('Netlify routes use the same methods and paths as the existing app', () => {
  assert.equal(providersRoute.path, '/api/providers');
  assert.equal(providersRoute.method, 'GET');
  assert.equal(generationRoute.path, '/api/generate-activities');
  assert.equal(generationRoute.method, 'POST');
});

test('Netlify allows paid generation only with a verified platform user and configured key', async (t) => {
  const previous = {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ENABLE_LIVE_GENERATION: process.env.ENABLE_LIVE_GENERATION,
  };
  t.after(() => {
    for (const [name, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  const key = 'netlify-test-only-key';
  process.env.OPENAI_API_KEY = key;
  delete process.env.ENABLE_LIVE_GENERATION;
  const loggedIn = { user: { id: 'netlify-test-user', email: undefined, expiresAt: new Date(Date.now() + 60_000) } };
  const providerCall = t.mock.method(globalThis, 'fetch', async (input: string, init?: RequestInit) => {
    assert.equal(input, 'https://api.openai.com/v1/responses');
    assert.equal(new Headers(init?.headers).get('Authorization'), 'Bearer ' + key);
    return Response.json({
      status: 'completed',
      output: [{
        type: 'message',
        role: 'assistant',
        content: [{ type: 'output_text', text: JSON.stringify({ activities: demoActivities }) }],
      }],
    });
  });

  const spoofedHeaders = { 'X-Nf-User': loggedIn.user.id };
  const guestStatus = await providers(new Request(site + providersRoute.path, { headers: spoofedHeaders }), {});
  assert.equal(providerStatusSchema.parse(await guestStatus.json()).mode, 'demo');
  assert.equal((await generateActivities(post('openai', spoofedHeaders), {})).status, 503);
  assert.equal((await generateActivities(post('openai', { Origin: 'https://unrelated.example' }), loggedIn)).status, 403);
  assert.equal(providerCall.mock.callCount(), 0);

  const ownerStatus = await providers(new Request(site + providersRoute.path), loggedIn);
  const ownerStatusBody = await ownerStatus.json();
  assert.equal(providerStatusSchema.parse(ownerStatusBody).mode, 'openai');
  assert.ok(!JSON.stringify(ownerStatusBody).includes(key));

  const response = await generateActivities(post('openai'), loggedIn);
  assert.equal(response.status, 200, await response.clone().text());
  const result = generationResponseSchema.parse(await response.json());
  assert.equal(result.mode, 'openai');
  assert.equal(result.activities.length, 3);
  assert.equal(providerCall.mock.callCount(), 1);

  process.env.ENABLE_LIVE_GENERATION = 'false';
  const disabled = await providers(new Request(site + providersRoute.path), loggedIn);
  assert.equal(providerStatusSchema.parse(await disabled.json()).mode, 'demo');
  assert.equal((await generateActivities(post('openai'), loggedIn)).status, 503);
  assert.equal(providerCall.mock.callCount(), 1);
});
