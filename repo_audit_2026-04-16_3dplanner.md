# Repo Audit Report — 3DPlanner

## 1. Purpose (one sentence)
A browser-based 3D room planner for configuring and purchasing steel shelving bays (RackZone brand), built with React + Three.js and targeting Shopify cart integration.

**README consistency:** There is no README. ARCHITECTURE.md partially fills this role but is not discoverable by a new visitor who looks for the standard entry point.

---

## 2. Pairing
No paired Claude Project is referenced anywhere in the repo. Given that this is an early-stage product with a Phase 2 roadmap already documented in ARCHITECTURE.md, a paired Project for planning decisions (Shopify integration approach, GLB model pipeline, pricing logic) would reduce context re-loading overhead. Flag: gap.

---

## 3. Maturity
- **First commit:** 2026-04-01
- **Last commit:** 2026-04-15
- **Age:** 15 days
- **Commit count:** 7
- **Status:** Very early / active. Recently completed a vanilla-JS → Vite/React/TypeScript migration. The core planner works and is deployed to Vercel. Phase 2 (GLB models, Shopify integration) not yet started.

---

## 4. CLAUDE.md assessment
**Does not exist.** This is a gap. Claude Code operating in this repo has no orientation — no common commands, no conventions, no gotchas, no context about what's hardcoded vs. what's production-ready. Given that the repo already has a solid ARCHITECTURE.md, a CLAUDE.md could be thin and just reference it, then add the operational layer on top.

---

## 5. README assessment
**Does not exist.** This is a gap. A new visitor (or a returning-you in 3 months) lands on GitHub and sees no orientation. ARCHITECTURE.md is detailed and well-written, but it is an architecture doc, not an onboarding doc. Missing: what the project is for, how to install, how to run, deployment URL, license.

---

## 6. Folder structure

| Path | What's in it |
|---|---|
| `src/` | All application source — React components, Zustand store, types, utilities |
| `src/components/` | Three UI components: ThreeScene (3D canvas), LeftPanel (catalogue), RightPanel (cart) |
| `src/store/` | Single Zustand store file (`useSceneStore.ts`) |
| `src/lib/` | Pure utilities: hardcoded dev catalogue, room/placement validation helpers |
| `src/types/` | Shared TypeScript type definitions |
| `models/` | 7 GLB asset files (~1.7–1.8 MB each) — Phase 2, not yet wired in |
| `index.html` | **RETIRED legacy file** — vanilla JS monolith. Noted as pending deletion in ARCHITECTURE.md but still present. |
| `rackzone-planner.html` | **RETIRED legacy file** — same as above, also ~92 KB |

**Flag:** `index.html` and `rackzone-planner.html` are dead weight. ARCHITECTURE.md explicitly marks them for deletion. Every tool that does codebase search will find them and be confused. Delete them.

**Flag:** `strip-textures.js` at root — a one-off utility script with no documentation. Unclear if it's still needed or is also effectively retired.

---

## 7. Dependencies and environment

- **Manager:** npm (`package.json` + `package-lock.json` ✓)
- **Lockfile:** `package-lock.json` present ✓
- **`.env.example`:** Does not exist. Not currently needed (no env vars in use), but Phase 2 Shopify integration will require Storefront API keys — flag this now so it doesn't get committed.
- **No linting or formatting config** (no ESLint, no Prettier config file).

**Dependency version drift (ARCHITECTURE.md is stale):**

| Dependency | ARCHITECTURE.md says | Actual (package.json) |
|---|---|---|
| React | 18.x | **19.2.5** |
| Vite | 6.x | **8.0.8** |
| TypeScript | 5.x | **6.0.2** |
| Three.js | 0.170.x | **0.183.2** |

ARCHITECTURE.md was likely written at migration start and not updated at the end. All four version numbers are wrong. This is the kind of staleness that quietly misleads.

**Dependency health:** All packages are current majors (React 19, Vite 8, Three.js 0.183). No obvious abandoned or insecure packages.

---

## 8. How to run it

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev server | `npm run dev` |
| Build | `npm run build` |
| Preview build | `npm run preview` |
| **Test** | **Missing — no test script, no test runner** |
| **Lint** | **Missing — no lint script, no ESLint config** |
| Deploy | Automatic via Vercel on push to main (inferred from vercel.json; not documented anywhere) |

The gap between `npm run build` and "it's live on Vercel" is undocumented. Someone unfamiliar with Vercel won't know how deployment works.

---

## 9. Tests
**None.** No test folder, no test files, no test runner configured. Zero coverage.

For the current scope (a 15-day-old project mid-migration) this is defensible. But the placement validation logic in `roomUtils.ts` — `isWithinBounds()`, `hasCollision()`, `validateLayout()` — is exactly the kind of pure, side-effect-free code that is trivial to unit test and where bugs would silently produce wrong room configurations. This is the first place to add tests when the project matures.

---

## 10. Configuration and secrets
- **Config:** No runtime config system. Room dimensions and product catalogue are hardcoded defaults in the Zustand store and `devCatalogue.ts`.
- **Secrets:** None currently. No Shopify API keys, no env vars at all.
- **`.env` committed:** No (not present).
- **`.env.example`:** Not present. Should be created before Phase 2 Shopify work starts.
- **Security TODOs:** None in code. However, `devCatalogue.ts` contains real product SKUs hardcoded — when Shopify integration lands, this file should be replaced with a proper catalogue fetch, not extended with more hardcoded data.
- **Sensitive git history:** No secrets observed in the 7-commit history.

---

## 11. What's working

1. **ARCHITECTURE.md is genuinely good.** It covers state shape, all Zustand actions, the procedural geometry model, placement validation logic, and the Phase 2 roadmap. Most repos this age have nothing at this depth.
2. **Clean source structure.** `src/` is well-organised: types are isolated, utilities are pure functions, store is centralised. Easy to navigate.
3. **Lockfile present.** `package-lock.json` means reproducible installs — not a given on small solo projects.
4. **Deployment is wired.** `vercel.json` correctly handles SPA routing rewrites. The project is actually live, not just local.
5. **Migration boundary is clearly marked.** Legacy files are annotated as RETIRED in ARCHITECTURE.md, and the commit history tells the story cleanly.

---

## 12. What's friction

1. **No README means every re-entry costs orientation time.** The repo URL tells you nothing. You have to find ARCHITECTURE.md, infer that it's the entry point, then orient from there. A 10-line README would eliminate this.
2. **ARCHITECTURE.md version table is wrong.** You'll check the table, read "React 18.x", then wonder why the code uses React 19 APIs. This is low-stakes now but will cause confusion when debugging version-specific behaviour.
3. **Retired legacy files are still present.** `index.html` and `rackzone-planner.html` are 92 KB each of dead vanilla JS. Any search ("where is product X rendered?") will hit them with false positives.
4. **No linting means silent TypeScript drift.** With strict mode enabled in tsconfig, the compiler catches type errors. But code style, unused imports, and consistency issues accumulate invisibly without ESLint.
5. **Hardcoded catalogue in `devCatalogue.ts` will become a trap.** It works now with 4 SKUs. When someone adds a 5th product directly to that file instead of wiring a real catalogue source, the "dev" prefix stops being meaningful.

---

## 13. What would you do differently if starting over

1. **README.md on day one, CLAUDE.md on day one.** Write them at project creation before any code. Ten lines each. Update them at each significant milestone. The cost is minutes; the benefit compounds.
2. **Vitest configured at migration time, not after.** The migration to TypeScript + Vite was the natural moment to add Vitest (it's the Vite-native test runner, zero config). `roomUtils.ts` would have had tests from the start.
3. **ESLint + Prettier set up in the same commit as Vite config.** Not a separate "we'll do it later" task — later never comes. One PR: Vite + TS + ESLint + Prettier.
4. **`devCatalogue.ts` named `mockCatalogue.ts` with a comment: "replace with Shopify Storefront API fetch."** Forces the Phase 2 decision to be explicit rather than implied.
5. **Delete retired files in the migration commit.** Don't leave them pending. The migration PR was the moment to remove them; instead they sit and confuse.

---

## 14. Meta-patterns worth exporting

1. **ARCHITECTURE.md as a first-class document.** The pattern of having a dedicated architecture doc (separate from README) that covers state shape, component responsibilities, and a roadmap is high-value. Most repos skip it. The format here (tables for state fields and actions, annotated directory tree) is exportable as a template.
2. **Pure utility layer isolated from side effects.** `roomUtils.ts` has zero imports from React or Three.js — it's plain TypeScript operating on plain data. This makes it trivially testable and reusable. Any repo that has business logic should isolate it this way.
3. **Single Zustand store with explicit action inventory.** Rather than spreading state across multiple contexts or component-local state, everything is in one file with a documented action table. For a project this size, this removes a whole class of "where does this state live?" questions.

---

## 15. Meta-patterns we should import

1. **CLAUDE.md with operational layer.** The repo has the architecture documented but not the operational layer: what commands to run, what the gotchas are, what's hardcoded, what Claude should not touch. Standard pattern: CLAUDE.md = ARCHITECTURE.md pointer + commands + conventions + gotchas.
2. **Automated tests for pure business logic from day one.** Vitest + a `tests/` folder with unit tests for `roomUtils.ts` functions. Not for coverage theatre — specifically for the placement validation and collision logic where a silent wrong answer produces a bad room plan.
3. **`.env.example` pre-emptively.** Even with no env vars today, creating `.env.example` now (empty, with a comment "# Shopify Storefront API key will go here") establishes the pattern before the keys exist, so they never accidentally get committed.

---

## 16. Single highest-leverage change

**Create CLAUDE.md.**

Every other gap (no README, stale ARCHITECTURE.md versions, retired files, no linting) costs minutes to fix but you'll probably fix them the next time you're in the repo anyway. The absence of CLAUDE.md costs something every single Claude Code session: re-orientation, re-explaining the stack, re-discovering that `devCatalogue.ts` is hardcoded, re-remembering that `index.html` is dead. A 30-line CLAUDE.md — what the project is, the three commands, the four conventions, the two gotchas (retired files, dev catalogue) — pays back every session going forward.

---

*End of report.*
