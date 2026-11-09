# API gateway for y2-consulting

This prototype relays a fixed `/api` endpoint through a public Worker to the existing `/consulting-manager/api` Funnel path. Firebase Hosting and MongoDB remain in their current locations. The configured public API endpoint is `https://y2-consulting-api.myljk1025.workers.dev/api`; the upstream Funnel path remains in place.

Run `node --test infra/cloudflare-api-gateway/worker.test.mjs server/test/gateway-rate.test.js`.

Before enabling, set a unique strong random secret (at least 32 characters) both in Worker Secret `GATEWAY_HMAC_SECRET` and Jenkins Secret text `consulting-manager-gateway-hmac`. Never store or log that value in source control or chat. `GATEWAY_ENABLED=true` in `deploy/jenkins/deploy.env` requires this credential. Keep the existing API URL while deploying server support first. Test matching secret, authenticated client-IP separation, direct and malformed requests, preflight, login, session and logout against the actual Worker before updating API URLs. Confirm the actual wired network can access the Worker hostname before switching Firebase Hosting.

Requests from other Workers are blocked on login to avoid trusting mutable caller IPs. A missing or mismatched backend secret causes signed login requests to fail with 503 rather than share a rate-limit bucket; direct requests without gateway headers retain their existing IP limit. The Free plan has quotas; no billing upgrade is configured by this code. `wrangler.toml` fixes the compatibility date for standard TransformStream; actual runtime behavior must still be tested.
