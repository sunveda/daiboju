# Gemini context

Follow `AGENTS.md` (rules) and `SPEC.md` (product, architecture, work queue in §12).

This app uses Gemini 4 Argon (`gemini-4-argon`) in `api/_lib/argon.js` to write the second alert. When improving it, keep `thinkingLevel: "low"` for speed, keep the JSON schema and validation, and never let the model change the decided ACTION.
