**Welcome to your Base44 project** 

**About**

View and Edit  your app on [Base44.com](http://Base44.com) 

This project contains everything you need to run your app locally.

**Edit the code in your local development environment**

Any change pushed to the repo will also be reflected in the Base44 Builder.

**Prerequisites:** 

1. Clone the repository using the project's Git URL 
2. Navigate to the project directory
3. Install dependencies: `npm install`
4. Create an `.env.local` file and set the right environment variables

```
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url

e.g.
VITE_BASE44_APP_ID=cbef744a8545c389ef439ea6
VITE_BASE44_APP_BASE_URL=https://my-to-do-list-81bfaad7.base44.app
```

Run the app: `npm run dev`

**Publish your changes**

Open [Base44.com](http://Base44.com) and click on Publish.

**Docs & Support**

Documentation: [https://docs.base44.com/Integrations/Using-GitHub](https://docs.base44.com/Integrations/Using-GitHub)

Support: [https://app.base44.com/support](https://app.base44.com/support)

## Agent Integration Runtime

This app now supports two execution modes:

1. Local orchestration mode (default)
- Uses in-app agent fabric, event bus simulation, workflow state, and telemetry.
- No backend required.

2. Remote orchestration mode
- Set `VITE_AGENT_BACKEND_URL` to route `functions.invoke(...)` to your backend.
- If remote call fails, runtime falls back to local orchestration.

### Recommended env vars

```bash
VITE_BASE44_APP_ID=your_app_id
VITE_BASE44_APP_BASE_URL=your_backend_url
VITE_AGENT_BACKEND_URL=https://your-agent-gateway.example.com
```

## Production Hardening Checklist

- Configure real event bus (Kafka/NATS) behind `VITE_AGENT_BACKEND_URL`.
- Persist agent/workflow/event state in PostgreSQL.
- Add vector memory provider for shared semantic context.
- Enforce mTLS + service-account RBAC between agent services.
- Add OpenTelemetry traces with correlation IDs from command center through agent calls.
- Run CI gates: lint, build, integration click-through tests.

### Local backend runtime

Run backend API:

```bash
npm run backend
```

Runtime endpoints:

- `GET /health`
- `GET /registry`
- `GET /manifest`
- `GET /capabilities`
- `GET /events?limit=50`
- `GET /workflows?limit=50`
- `POST /invoke` with `{ "functionName": "...", "payload": { ... } }`
- `POST /functions/:functionName` (compat route)

### Quality gates

```bash
npm run lint
npm run build
npm run test:actions
```

### Skills-wired agent audit workflow

```bash
npm run skills:preflight
npm run audit:agents
```

- `skills:preflight` checks installed Codex skills and maps them to required audit groups.
- `audit:agents` runs preflight + lint + build + e2e in one pass.
- Strict mode: `npm run skills:preflight:strict`

See [docs/runbooks/skills-wired-workflow.md](./docs/runbooks/skills-wired-workflow.md) for details.

`test:actions` scans all page/component `base44.functions.invoke(...)` calls and executes each discovered `function + action` pair against runtime, failing on dead actions.

### Auth mode

The app runs in local-first mode and no longer depends on a login page route. `/login` and `/signin` redirect to `/`.

### E2E smoke tests (Playwright)

```bash
npm run test:e2e
```

These cover critical routes and baseline agent-page responsiveness.

### Remote conversation APIs

When `VITE_AGENT_BACKEND_URL` is set, chat uses backend persistence via:

- `POST /conversations`
- `GET /conversations/:id`
- `POST /conversations/:id/messages`

This enables persistent chat state across refreshes in real mode.

### System verification runbook

After starting backend and app, run:

```bash
npm run verify:system
```

This checks backend health, registry, capabilities, key agent actions, and conversation persistence APIs.

## Phase 1 Control Plane (Implemented)

The backend now includes a Phase 1 control-plane wrapper around function execution:

- Auth + RBAC (dev-token and role-based permission checks)
- Policy engine (allow/deny + risky-action approval requirement)
- Idempotency (`Idempotency-Key` / `X-Idempotency-Key`)
- Retry orchestration (configurable attempts and backoff)
- Approval workflow for risky actions
- Guardrails (rate limits + daily budget controls)

### New endpoints

- `GET /auth/dev-token?role=admin&user_id=local-admin`
- `GET /v1/approvals`
- `POST /v1/approvals/:approvalId/approve`
- `GET /v1/budgets`

### Control-plane env vars

- `AGENT_AUTH_REQUIRED=false`
- `APPROVALS_REQUIRED_FOR_RISKY=true`
- `IDEMPOTENCY_TTL_MS=3600000`
- `ORCH_RETRY_ATTEMPTS=3`
- `ORCH_RETRY_BASE_DELAY_MS=300`
- `RATE_LIMIT_WINDOW_MS=60000`
- `RATE_LIMIT_MAX=240`
- `DEFAULT_DAILY_BUDGET_USD=100`

## Phase 2 Data + Memory Layer (Implemented)

Added persistence and memory adapters with local-first fallback and PostgreSQL/vector-ready schema.

### New backend modules
- `backend/persistencePhase2.mjs` (execution and audit persistence)
- `backend/vectorMemoryPhase2.mjs` (vector-like semantic memory search)
- `backend/sql_phase2_schema.sql` (PostgreSQL schema for production)

### New endpoints
- `GET /v2/persistence/status`
- `GET /v2/executions?limit=100`
- `GET /v2/audit?limit=100`
- `GET /v2/vector/status`
- `POST /v2/vector/upsert`
- `POST /v2/vector/search`

### Env vars used by Phase 2
- `PERSISTENCE_PROVIDER` (default `local_json`)
- `DATABASE_URL` (presence detected for production DB wiring)
- `VECTOR_PROVIDER` (default `local`)
- `VECTOR_ENDPOINT`

## Phase 3 Connector Layer (Implemented)

Added unified connector management for live integration domains.

### Connector domains
- CRM
- Email
- Calendar
- Finance
- Support
- E-commerce
- Docs
- Security

### New endpoints
- `GET /v3/connectors`
- `GET /v3/connectors/templates`
- `GET /v3/connectors/:key`
- `POST /v3/connectors/:key/save`
- `POST /v3/connectors/:key/secrets`
- `POST /v3/connectors/:key/test`

These endpoints store connector profiles, store secret references (not raw secrets), and run connectivity probes.

## Phase 4 Observability + Eval Harness (Implemented)

### New endpoints
- `GET /v4/observability`
- `GET /v4/slo`
- `GET /v4/evals/suites`
- `POST /v4/evals/run`

### New scripts
- `npm run verify:phase4` -> checks eval/slo/observability endpoints.

### SLO env defaults
- `SLO_SUCCESS_RATE_MIN=0.98`
- `SLO_P95_LATENCY_MAX_MS=2500`

## Phase 5 Production Deployment Pack (Implemented)

### Artifacts
- `Dockerfile`
- `.dockerignore`
- `docker-compose.prod.yml`
- `deploy/k8s/*` manifests (namespace, configmap, secret template, deployment, service, ingress, hpa, pdb)
- `deploy/scripts/backup.sh`
- `deploy/scripts/restore.sh`
- `docs/runbooks/deployment.md`
- `docs/runbooks/backup-restore.md`
- `docs/runbooks/disaster-recovery.md`
- `.github/workflows/release.yml`

### Release flow
- Trigger GitHub Actions `Release` workflow with `image_tag`
- Image pushed to `ghcr.io/<repo>:<image_tag>`
- Apply Kubernetes manifests with updated image tag

## Phase 6 Security Hardening (Implemented)

### Kubernetes hardening
- Namespace pod-security labels (restricted)
- ServiceAccount + Role/RoleBinding (least privilege)
- Deployment hardened with:
  - non-root runtime
  - seccomp runtime default
  - read-only root filesystem
  - dropped Linux capabilities
  - no token automount
- NetworkPolicy restricting ingress/egress
- Optional Kyverno policy for signed image verification

### Supply chain security
- Release workflow now signs images with cosign keyless
- Release workflow verifies signature against GitHub OIDC identity

### Secret operations
- Rotation script: `deploy/scripts/rotate-secrets.sh`
- GitHub workflow: `.github/workflows/rotate-secrets.yml`
- Runbook: `docs/runbooks/security-hardening.md`
