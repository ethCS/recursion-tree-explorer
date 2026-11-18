# Agent guide: Recursion Tree Explorer

Instructions for AI coding agents and new contributors. Read this before changing or deploying anything. `README.md` describes the app itself; `DESIGN_NOTES.md` explains why it looks and behaves the way it does.

**This repo is public.** Never commit secrets, tokens, keys, `.env` files, personal details, or details about the private site repo beyond what is already here (its name and the folder the build goes into).

## What this is

A static Vite + React + TypeScript app (KaTeX for maths, exact BigInt rationals, no backend). Production builds are served at https://eethan.com/projects/dsa/live/.

## Everyday commands

| Task | Command |
| --- | --- |
| Install | `npm ci` (Node 20.19+ / 22.12+) |
| Dev server | `npm run dev` → http://localhost:5173/ (served at `/` in dev) |
| Tests | `npm test` (Vitest; must pass, because CI blocks the deploy otherwise) |
| Type-check | `npm run typecheck` |
| Production build | `npm run build` → `dist/projects/dsa/live/` |
| Preview the build | `npm run preview` → http://localhost:4173/projects/dsa/live/ |
| Browser QA (local Chrome) | `node scripts/qa.mjs http://localhost:5173/ [scenario…]` → `screenshots/` (gitignored) |

Where the code lives: maths in `src/math/` (pure, unit-tested), explanation text in `src/explain/`, UI in `src/components/`. See "Project layout" in `README.md`.

## Deploy pipeline (automatic)

Pushing to `main` **is** the deploy. Nothing else needs doing.

```
push to main (this repo)
  └─ GitHub Actions: .github/workflows/deploy-site.yml
       1. check out this repo, and the site repo (ethCS/my_website) using the deploy key
       2. npm ci
       3. scripts/sync-to-site.sh, with SITE_DIR set to the site checkout:
            npm test → clean build → check base path → rsync --delete into
            site/public/projects/dsa/live/
       4. if that folder changed: commit as github-actions[bot] and push to the site's main
            (retries with a rebase if the site's main moved meanwhile)
  └─ the site's host (Cloudflare Workers Builds) deploys the site's main
       → live at https://eethan.com/projects/dsa/live/ a few minutes later
```

- **Skipped:** pushes touching only `**/*.md`, `scripts/qa.mjs` or `scripts/shot.mjs`. To deploy anyway: `gh workflow run deploy-site.yml`.
- **No-op:** if the build output is byte-identical to what the site has, nothing is committed.
- **Credentials:** a single Actions secret, `SITE_DEPLOY_KEY`. It's the private half of an SSH deploy key with write access to the site repo only, nothing else. The workflow never prints it.

### Verifying a deploy

```sh
gh run list --workflow deploy-site.yml --limit 3      # this repo's runs
gh run watch                                          # follow the latest run
curl -sI https://eethan.com/projects/dsa/live/ | head -1   # expect 200
```

The run log's last step prints the site commit it pushed. Every CI build stamps the explorer commit it was built from into the page. Check what is live with:

```sh
curl -s https://eethan.com/projects/dsa/live/ | grep -o 'rte-build" content="[^"]*'   # should equal: git rev-parse HEAD
```

`local` means the live copy came from a manual `npm run sync:site`.

### If the workflow fails

| Symptom in the run log | Cause and fix |
| --- | --- |
| Fails in "Check out site" with `Permission denied (publickey)` | The secret or deploy key is missing or was rotated. A repo admin re-creates them; the site repo's README documents how. |
| Fails in "Test, build and copy" | A test or the build failed. Fix it here and push again. The site was not touched. |
| `error: built index.html does not reference /projects/dsa/live/assets/` | The Vite `base` changed. Production must use `/projects/dsa/live/` (see `vite.config.ts`). |
| Push fails 3 times | The site's main kept moving or has conflicting changes in `public/projects/dsa/live/`. Re-run the workflow. |
| Run succeeded but the site isn't updated | Check the site host's build for the pushed site commit. That deploy belongs to the site repo, not this one. |

## Rules for agents

- Deploy by pushing to `main` here. Don't hand-edit the build inside the site repo, because the next deploy overwrites it.
- Keep the production base path `/projects/dsa/live/`, and don't remove the base-path check in `scripts/sync-to-site.sh`.
- Workflow security, because the repo is public: never add `pull_request_target`, and never expose `SITE_DEPLOY_KEY` to `pull_request` runs. Keep `permissions: contents: read`. Pin third-party actions to full commit SHAs.
- Run `npm test` and `npm run typecheck` before pushing. A red test blocks the deploy, which is intended.
- Commits should use a GitHub no-reply email (`<id>+<login>@users.noreply.github.com`), not a personal address.
- Navigation state lives in the URL hash, so there's no router and no SPA fallback to configure.
