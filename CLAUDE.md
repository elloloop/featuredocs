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

- **Setup:** `npm install` (root Next.js); `cd cli && npm install`; `cd api && go mod download`
- **Analyze/lint:** `npm run lint` (ESLint flat config, `eslint-config-next`); Go API: `cd api && go vet ./...`
- **Test (all):** Go API: `cd api && go test ./...`; browser e2e: `cd e2e && npx playwright test` (no root unit-test script)
- **Test (single):** Go: `cd api && go test ./internal/feedback/...`; e2e: `cd e2e && npx playwright test featuredocs.spec.ts`
- **Format:** `gofmt -w .` in `api/` (no JS/TS formatter configured — ESLint only)
- **Run an app:** `npm run dev` (Next.js dev at :3000, static export via `output: "export"`); API: `cd api && go build ./cmd/server && PORT=8080 ./server`
- **Repo layout:** `src/` (Next.js App Router pages, components, lib/api Connect client); `api/` (Go ConnectRPC server: cmd/server, internal/{feedback,content,github,turnstile,ratelimit,storage}, proto, gen); `cli/` (TS Node CLI — commander, R2 upload, publish/translate); `content/` (markdown + JSON docs); `e2e/` (Playwright)
- **State management / data layer:** No database — content is markdown/JSON files on disk (`content/`, read via `CONTENT_DIR`); frontend talks to the Go API over Connect/gRPC-Web (`src/lib/api/client.ts`, `NEXT_PUBLIC_API_URL`); feedback is stored as GitHub Issues; media in Cloudflare R2/S3
- **Generated files (do not hand-edit):** `api/gen/**` (buf-generated from `api/proto/`, regenerate via `buf generate`); `next-env.d.ts`; `cli/dist/` (tsc output); `out/`, `.next/`
- **Other gotchas:** `NEXT_PUBLIC_API_URL` is baked in at `npm run build` time; Next.js uses static export (`output: "export"`, `trailingSlash: true`, unoptimized images) deployed to Firebase Hosting (`public: "out"`); API config is all env vars (`GITHUB_TOKEN`, `TURNSTILE_SECRET_KEY`, `R2_*`, `CORS_ORIGINS`, etc.); the feedback email field is a honeypot (`hp:` prefix silently discarded); deploy via `./deploy.sh` (Firebase Hosting + Cloud Run via `api/cloudbuild.yaml`); README mentions better-sqlite3 but the current architecture is fileystem + Go API (README is stale on storage); no CI workflows present
