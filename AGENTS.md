# Working on Daiboju

Instructions for any coding agent (Gemini / Antigravity, Codex, Claude) and for humans.

Read `SPEC.md` first. The work queue is in SPEC.md §12.

## Rules
1. **Safety first.** Never let AI decide what people should do. `decideAction()` in `api/_lib/hazards.js` decides; Argon only explains. Do not move this logic into a prompt.
2. **The first alert never waits for AI.** Stage 1 uses `templates.js` only.
3. **Every Argon call must have a fallback.** If you change `argon.js`, keep the timeout, the schema validation and the template fallback.
4. **Privacy.** Do not add fields to the subscriber record. Never send contact data or user location to the server or to Argon. Location is used only in the browser on `/go`.
5. **Drills never reach real users.** Keep the `drill` filter in `subscribersIn()` and the DRILL label.
6. **Keep dependencies near zero.** Use built-in `fetch` and `node:crypto`. Node 22, ES modules.
7. **Test everything.** `npm test` must pass. Add a test for every rule change, new hazard, new channel or new data source. Tests must not use the network.
8. **Translations** of safety text need a native-speaker review before launch; mark machine-made ones with `// TODO(review)`.

## Commands
- `npm test` · run the suite
- `npm run dev` · local server on :3000 that behaves like Vercel (in-memory store, dry-run channels)
- `npm run keys` · generate secrets

## Conventions
- Vercel functions in `api/*.js` export `GET` / `POST` taking a Web `Request` and returning a `Response`.
- Shared code lives in `api/_lib/` (underscore = not deployed as a function).
- Commit as small, focused changes with clear messages.
