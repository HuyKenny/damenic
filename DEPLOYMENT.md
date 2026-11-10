# Deployment

## Where things run
| What | Where |
|---|---|
| Source and history | GitHub `HuyKenny/damenic` (public → Actions minutes are free) |
| Install, type check, lint, unit + e2e tests, build, screenshots | GitHub-hosted `ubuntu-latest` runners (`.github/workflows/ci.yml`) |
| Lockfile regeneration | GitHub runner, manual workflow `lockfile` |
| Hosting | Cloudflare Workers Static Assets, Worker `damenic`, custom domains `damenic.cz` + `www.damenic.cz` |
| Optional remote dev | `.devcontainer/` for Codespaces (not used by default; free tier is 120 core-hours/month) |

Nothing is built or tested on the Raspberry Pi.

## Pipeline (`ci.yml`)
- `pull_request`: checks only. No secrets are exposed (forks cannot read them; we never use `pull_request_target`).
- `push` to `main`: the same checks, then job `deploy` (environment `production`) downloads the built `dist/` and runs `wrangler deploy`.
- `concurrency` cancels superseded runs; job timeouts 20 / 10 min; artifacts kept 1–3 days; no retries.
- There is exactly one deploy path. Do not connect Cloudflare's Git integration to this repo.

## Secrets (GitHub → Settings → Secrets → Actions)
- `CLOUDFLARE_API_TOKEN` — scoped token: Workers Scripts edit (account) + Workers Routes, DNS edit, Zone read on `damenic.cz` only.
- `CLOUDFLARE_ACCOUNT_ID`
Locally the same values are in `~/ai/credentials/.damenic-credentials.env` (never in this repo).

## Changing dependencies
1. Edit `package.json` on the Pi (no install).
2. Run the `lockfile` workflow: `gh workflow run lockfile --repo HuyKenny/damenic`. It commits `package-lock.json`.
3. Pull, then push your change; CI runs `npm ci`.

## Cloudflare cost
Static asset requests are free and unlimited, and there is no Worker script, so the site adds 0 $ to the account
(account cap is 6 $/month). Do not add `main`, `run_worker_first`, D1, KV, Durable Objects, cron triggers or image resizing
without a cost estimate first. `workers_dev` and preview URLs are off so there is no indexable duplicate.

## Verify a deploy
```
curl -sI https://damenic.cz/ | head -1                 # 200
curl -s -o /dev/null -w '%{http_code}' https://damenic.cz/neexistuje/   # 404
curl -s https://damenic.cz/kosik/ | grep -o 'noindex'
```
