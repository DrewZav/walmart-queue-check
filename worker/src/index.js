/**
 * BLACK BOX queue-checker analytics (Cloudflare Worker + KV).
 *
 * POST /v1/event   — anonymous usage beacon (public)
 * GET  /v1/stats   — requires ?key= or Authorization: Bearer (private)
 * GET  /health     — ok
 *
 * Bindings:
 *   ANALYTICS_KV  — KV namespace
 *   ADMIN_KEY     — secret
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      ...CORS,
      ...extra,
    },
  });
}

function unauthorized() {
  return json({ ok: false, error: 'unauthorized' }, 401);
}

function authorize(request, env) {
  const expected = String(env.ADMIN_KEY || '').trim();
  if (!expected) return false;
  const url = new URL(request.url);
  const q = url.searchParams.get('key') || '';
  const auth = request.headers.get('Authorization') || '';
  const bearer = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  return q === expected || bearer === expected;
}

function sanitizeEvent(body = {}) {
  const visitorId = String(body.visitorId || '').slice(0, 80);
  if (!visitorId || visitorId.length < 8) return null;
  const waitMin = Number(body.waitMin);
  const advertisedWaitMin = Number(body.advertisedWaitMin);
  return {
    visitorId,
    itemId: String(body.itemId || '').slice(0, 40),
    itemName: String(body.itemName || '').slice(0, 120),
    queue: String(body.queue || '').slice(0, 64),
    ticket: String(body.ticket ?? '').slice(0, 32),
    state: String(body.state || '').slice(0, 32),
    waitMin: Number.isFinite(waitMin) ? Math.round(waitMin * 10) / 10 : null,
    advertisedWaitMin: Number.isFinite(advertisedWaitMin)
      ? Math.round(advertisedWaitMin * 10) / 10
      : null,
    ua: String(body.ua || '').slice(0, 160),
    at: new Date().toISOString(),
  };
}

async function readStats(env) {
  const raw = await env.ANALYTICS_KV.get('stats', { type: 'json' });
  return (
    raw || {
      checks: 0,
      uniqueVisitors: 0,
      firstSeenAt: null,
      lastSeenAt: null,
    }
  );
}

async function writeStats(env, stats) {
  await env.ANALYTICS_KV.put('stats', JSON.stringify(stats));
}

async function appendRecent(env, event) {
  const recent = (await env.ANALYTICS_KV.get('recent', { type: 'json' })) || [];
  recent.unshift({
    at: event.at,
    visitorId: event.visitorId.slice(0, 8) + '…',
    itemId: event.itemId,
    itemName: event.itemName,
    queue: event.queue,
    ticket: event.ticket,
    waitMin: event.waitMin,
    advertisedWaitMin: event.advertisedWaitMin,
    state: event.state,
  });
  await env.ANALYTICS_KV.put('recent', JSON.stringify(recent.slice(0, 100)));
}

async function handleEvent(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: 'invalid-json' }, 400);
  }
  const event = sanitizeEvent(body);
  if (!event) return json({ ok: false, error: 'bad-event' }, 400);

  // Never persist full Walmart /qp links — client must not send them.
  if (body.url || body.href || body.qpdata || body.link) {
    return json({ ok: false, error: 'links-not-allowed' }, 400);
  }

  const visitorKey = `visitor:${event.visitorId}`;
  const existing = await env.ANALYTICS_KV.get(visitorKey, { type: 'json' });
  const isNew = !existing;
  await env.ANALYTICS_KV.put(
    visitorKey,
    JSON.stringify({
      firstSeenAt: existing?.firstSeenAt || event.at,
      lastSeenAt: event.at,
      checks: Number(existing?.checks || 0) + 1,
      lastItemId: event.itemId || existing?.lastItemId || '',
    }),
  );

  const stats = await readStats(env);
  stats.checks = Number(stats.checks || 0) + 1;
  if (isNew) stats.uniqueVisitors = Number(stats.uniqueVisitors || 0) + 1;
  stats.firstSeenAt = stats.firstSeenAt || event.at;
  stats.lastSeenAt = event.at;
  await writeStats(env, stats);
  await appendRecent(env, event);

  // Item rollup
  if (event.itemId) {
    const itemKey = `item:${event.itemId}`;
    const item = (await env.ANALYTICS_KV.get(itemKey, { type: 'json' })) || {
      itemId: event.itemId,
      name: event.itemName,
      checks: 0,
    };
    item.checks = Number(item.checks || 0) + 1;
    item.name = event.itemName || item.name;
    item.lastSeenAt = event.at;
    await env.ANALYTICS_KV.put(itemKey, JSON.stringify(item));
  }

  return json({ ok: true });
}

async function handleStats(request, env) {
  if (!authorize(request, env)) return unauthorized();
  const stats = await readStats(env);
  const recent = (await env.ANALYTICS_KV.get('recent', { type: 'json' })) || [];

  const itemList = await env.ANALYTICS_KV.list({ prefix: 'item:', limit: 50 });
  const items = [];
  for (const key of itemList.keys) {
    const row = await env.ANALYTICS_KV.get(key.name, { type: 'json' });
    if (row) items.push(row);
  }
  items.sort((a, b) => Number(b.checks || 0) - Number(a.checks || 0));

  return json({
    ok: true,
    generatedAt: new Date().toISOString(),
    stats,
    topItems: items.slice(0, 20),
    recent,
  });
}

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS });
    }

    const url = new URL(request.url);
    if (url.pathname === '/health') return json({ ok: true });
    if (url.pathname === '/v1/event' && request.method === 'POST') {
      return handleEvent(request, env);
    }
    if (url.pathname === '/v1/stats' && request.method === 'GET') {
      return handleStats(request, env);
    }
    return json({ ok: false, error: 'not-found' }, 404);
  },
};
