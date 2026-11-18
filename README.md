# Recursion Tree Explorer

An interactive explorer for divide-and-conquer recurrences of the form

```
T(n) = a₁T(n/b₁) + a₂T(n/b₂) + a₃T(n/b₃) + n^d
```

Edit any number marked with a pencil. Point at any part of the formula to see what it is. The recursion tree, the level table, the level-total bars and the derivation all update together. The point it builds toward is that **each level's total is the previous level's total × r**, where `r = Σ aᵢ / bᵢ^d`. The level totals form a geometric series, so:

| r     | Level totals    | Answer                             |
| ----- | --------------- | ---------------------------------- |
| r < 1 | shrink          | the root dominates: Θ(n^d)         |
| r = 1 | stay equal      | Θ(n^d log n)                       |
| r > 1 | grow            | the leaves dominate: Θ(n^p)        |

In the last row, p solves Σ aᵢ / bᵢ^p = 1. For a single term, p = log_b a.

Stack: Vite + React + TypeScript and KaTeX, built as a static site with no backend. All maths lives in `src/math/` as pure TypeScript and uses exact BigInt rationals.

## Setup

Requires Node 20.19+ or 22.12+, which is Vite 8's requirement. Development used Node 25.

```sh
npm install
npm run dev          # http://localhost:5173/  (served at the root in dev)
```

## Scripts

| Command              | What it does                                                          |
| -------------------- | --------------------------------------------------------------------- |
| `npm run dev`        | Dev server at `/`                                                     |
| `npm test`           | Vitest: maths module, plus every explanation rendered through KaTeX   |
| `npm run typecheck`  | `tsc -b`                                                              |
| `npm run build`      | Type-check, then build for `/projects/dsa/live/` into `dist/projects/dsa/live/` |
| `npm run build:root` | Same, but for serving at `/` (output in `dist/`)                      |
| `npm run preview`    | Serve the last build locally                                          |
| `npm run sync:site`  | Rebuild and copy the build into the eethan.com repo (see below)       |

The base path comes from the `BASE_PATH` environment variable. If it isn't set, it is `/projects/dsa/live/` for builds and `/` for dev, so `BASE_PATH=/some/where/ npm run build` works for any other sub-path. The build mirrors the base path inside `dist/`, which means any static server that treats `dist/` as its root serves the app at the right URL:

```sh
npm run build
cd dist && python3 -m http.server 8080   # open http://localhost:8080/projects/dsa/live/
```

## Deploying to eethan.com/projects/dsa/live

The live copy is served by the author's site at https://eethan.com/projects/dsa/live/. The built files are committed to the site's repo, which is private, and the site serves them as static files. Deploying is a two-repo job:

1. **Edit and preview here.** `npm run dev` serves the app at http://localhost:5173/ and reloads on save. `npm run test:watch` re-runs the tests as you work.
2. **Commit and push here.**
3. **Copy the build into the site:** run `npm run sync:site`. It runs the tests, builds for `/projects/dsa/live/`, and replaces `public/projects/dsa/live/` in the site checkout with the new build. It commits nothing. It stops before copying if a test fails or the build doesn't reference `/projects/dsa/live/assets/`.
4. **Commit and push that folder in the site repo.** Pushing the site deploys it. The site's README covers the rest.

`npm run build && npm run preview` serves the production build at http://localhost:4173/projects/dsa/live/, if you want to check it before syncing.

`scripts/sync-to-site.sh` finds the site checkout through `SITE_DIR`, which has a default in the script. It refuses to run if that folder isn't a clone of the site repo, and it only ever writes inside `public/projects/dsa/live/`.

Navigation state lives only in the URL hash (for example `#2T4+1T2+n1`), so no SPA fallback is needed.

## Project layout

```
src/math/        rational.ts (exact arithmetic), recurrence.ts (levels, r, Big-O,
                 concrete sums), format.ts, random.ts (+ *.test.ts)
src/explain/     derivation steps and click-to-learn explanations, generated
                 from live values
src/state/       selection/highlight context, URL hash, local preferences
src/tree/        tree layout (grouping, node cap, bands)
src/components/  Formula, TreeView, LevelPanel, Verdict/Predict, Derivation,
                 ExplainPanel, Concrete, Intro
scripts/qa.mjs   browser walkthrough (playwright-core + local Chrome)
```

`node scripts/qa.mjs http://localhost:5173/ [scenario…]` drives the running app through the main flows and saves screenshots to `screenshots/`. The scenarios are intro, select, predict, edit, concrete, random, presets, mobile, formula (tooltips, editing, keyboard), mformula (touch tooltips) and dark. The script expects Google Chrome at its standard macOS path.

## Scope and simplifications

- Floors and ceilings are dropped; the UI says so once, in the footer.
- Inputs: 1–3 recursive terms, a from 1 to 16, b from 2 to 16, and d a whole number from 0 to 4. d is kept whole so that r stays an exact rational.
- Terms with the same b are merged automatically, and the app tells you when it does.
