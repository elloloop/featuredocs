@AGENTS.md

---

## How I expect you to write code

**No shortcuts. "Simple" never means "sloppy."** A small diff that hardcodes,
duplicates, or skips a test isn't simpler — it's deferred cost.

1. **Fix causes, not symptoms.** Find the root cause before fixing. If you're
   applying a workaround, say so explicitly and explain why. Never swallow an
   exception or silence an error to make a problem disappear.

2. **Think about consequences.** Before changing shared or widely-used code,
   trace its callers and the invariants they rely on. A fix that's locally
   correct but breaks something elsewhere — now or later — is not a fix.

3. **SOLID, sensibly.** One responsibility per class/widget/function. Separate
   pure logic from I/O so it can be tested. Inject dependencies that cross a
   boundary so they're mockable. Don't add abstractions for things that don't
   cross a boundary.

4. **DRY about knowledge, not appearance.** Don't duplicate a rule or decision.
   Code that merely looks similar but changes for different reasons stays
   separate. When unsure, prefer duplication over a premature/wrong abstraction.

5. **No hardcoded values.** No magic numbers or strings inline — give them
   names. Environment/tenant/feature-specific values go in typed config in
   application code, never scattered literals, never the database.

6. **Readable & maintainable.** Clear names, short flat functions, early
   returns over deep nesting. Comments explain *why*, not *what*. Match the
   existing style of the file you're editing.

7. **Testable, and prove it.** Ship a test for behavior you add or change. If
   something is hard to test, that's a design smell — restructure until it
   isn't. "Works but can't be tested" means it isn't done.

A change is done only when: the cause (not a symptom) is fixed, no new hardcoded
values, a test covers it, and the analyzer/formatter are clean.

## Project facts

> Keep these current as the repo evolves; only write what you've confirmed.

- **Setup command:** `npm install` (frontend + `cli/`); `cd api && go mod download` (Go API)
- **Analyze/lint command:** `npm run lint` (ESLint via `eslint-config-next`); `cd api && go vet ./...`
- **Test command (all):** `cd api && go test ./...` (Go unit tests); `cd e2e && npx playwright test` (Playwright e2e); no frontend unit-test runner configured
- **Test command (single):** `cd api && go test ./internal/feedback -run TestName`; `cd e2e && npx playwright test featuredocs.spec.ts -g "title"`
- **Format command:** `cd api && go fmt ./...` (Go); frontend has no dedicated formatter script — ESLint only (`npm run lint`)
- **Run an app:** `npm run dev` (Next.js, http://localhost:3000); `cd api && go run ./cmd/server` (Connect/gRPC API, port 8080)
- **Repo layout:** `src/` (Next.js App Router frontend: `app/`, `components/`, `lib/`), `content/` (markdown + video docs source), `api/` (Go Connect/gRPC API: `cmd/server`, `internal/*`, `proto/`, `gen/`), `cli/` (TypeScript content-management CLI), `e2e/` (Playwright tests)
- **State management / data layer:** Frontend is statically exported (`output: "export"`); content read from disk markdown/JSON via `src/lib/content-static.ts`; API calls go through hand-written Connect clients in `src/lib/api/` (`createConnectTransport`, base from `NEXT_PUBLIC_API_URL`). Go API is filesystem-backed content + GitHub Issues as feedback store (no DB); deps are interfaces injected via constructors, mocked in tests. README mentions a legacy better-sqlite3 `.data/feedback.db` path.
- **Generated files NOT to hand-edit:** `api/gen/**` (buf-generated Go protobuf/Connect stubs from `api/proto/`, regenerate with `buf generate`); `cli/dist/` (tsc output, gitignored); `next-env.d.ts`
- **Other gotchas worth recording:** `CLAUDE.md` just imports `@AGENTS.md` (currently a dangling reference — no AGENTS.md present). Frontend is a static Firebase Hosting export (`deploy.sh` → `firebase deploy`); Go API deploys to Cloud Run via `api/cloudbuild.yaml`. `NEXT_PUBLIC_API_URL` is baked in at build time. API config is all env vars (see `api/README.md`); `.env*` is gitignored except `.env.example`. Go module path is `github.com/glassa-work/featuredocs/api` (go 1.26.1).
