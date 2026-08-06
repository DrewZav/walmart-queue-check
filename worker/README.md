# Analytics (Cloudflare Worker)

Private usage stats for the BLACK BOX Walmart queue checker.

Public users only hit `POST /v1/event` (anonymous). Stats are at `GET /v1/stats` with `ADMIN_KEY`.

## Deploy

```bash
cd worker
npm install
npx wrangler login
npx wrangler kv namespace create ANALYTICS_KV
# paste the id into wrangler.toml (id + preview_id)
npx wrangler secret put ADMIN_KEY
npx wrangler deploy
```

Copy the `*.workers.dev` URL into `../analytics-config.js`:

```js
window.BB_ANALYTICS = {
  enabled: true,
  endpoint: 'https://bb-queue-analytics.<your-subdomain>.workers.dev',
};
```

Commit + push so GitHub Pages picks it up.

## Admin UI

Open: https://drewzav.github.io/walmart-queue-check/admin.html  
(not linked from the public page)

Enter worker endpoint + ADMIN_KEY.

## Privacy

- No full Walmart `/qp` links stored
- Visitor id = random UUID in localStorage
- Events keep item id/name, queue id, ticket #, wait minutes only
