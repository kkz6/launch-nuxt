# Managing docs from a separate GitHub repo

The `/docs` site is powered by [`@nuxt/content`](https://content.nuxt.com). By
default it reads markdown from this repo's local `content/docs/**` folder. You
can instead keep all docs in a **dedicated GitHub repository** and have the site
pull from it — editors then work entirely in that repo (PRs, the GitHub web
editor, or Nuxt Studio) without touching the app code.

## How it works

`content.config.ts` switches source based on an env var:

- `NUXT_CONTENT_DOCS_REPO` **unset** → local `content/docs/**` (used for dev).
- `NUXT_CONTENT_DOCS_REPO` **set** → pulls `docs/**/*.md` from that GitHub repo.
- `NUXT_CONTENT_GITHUB_TOKEN` → only needed when the docs repo is **private**.

> **Important:** `@nuxt/content` fetches the remote repo **at build time** and
> bakes the markdown into the build. A docs change therefore only appears after
> the site is **rebuilt and redeployed** — see "Auto-rebuild" below.

## One-time setup

### 1. Create the docs repo

Create e.g. `kkz6/launchctl-docs` and put markdown under a top-level `docs/`
folder (mirrors the current layout, so routes stay the same):

```
launchctl-docs/
└── docs/
    ├── overview.md
    ├── servers.md
    └── …
```

Seed it by copying this repo's existing `content/docs/*` into the new repo's
`docs/`.

### 2. Point the app at it

In the **launch-nuxt** repo settings:

- **Variables** → add `NUXT_CONTENT_DOCS_REPO` =
  `https://github.com/kkz6/launchctl-docs`
- **Private repo only** → **Secrets** → add `NUXT_CONTENT_GITHUB_TOKEN` (a
  fine-grained PAT with `Contents: Read` on the docs repo).

The CI build (`.github/workflows/docker.yml`) already passes the repo URL as a
build arg and the token as a BuildKit secret (so the token never lands in an
image layer). The Dockerfile wires them into `npm run build`.

For **local development** against the remote repo, set the same vars in `.env`.

### 3. Auto-rebuild on docs push

So editing docs ships automatically, add this workflow to the **docs repo**
(`.github/workflows/rebuild-site.yml`). On every push it tells launch-nuxt to
rebuild its image (which then redeploys):

```yaml
name: Rebuild docs site
on:
  push:
    branches: [main]
jobs:
  dispatch:
    runs-on: ubuntu-latest
    steps:
      - uses: peter-evans/repository-dispatch@v3
        with:
          # Fine-grained PAT with Actions: Read & write on kkz6/launch-nuxt.
          token: ${{ secrets.SITE_DISPATCH_TOKEN }}
          repository: kkz6/launch-nuxt
          event-type: docs-updated
```

launch-nuxt's `docker.yml` listens for the `docs-updated` event, rebuilds the
image with the fresh markdown, and dispatches the normal `deploy-nuxt` rollout.

## Summary of the flow

```
edit docs repo ──push──▶ docs repo workflow
        │
        └─ repository_dispatch: docs-updated ──▶ launch-nuxt docker.yml
                   │ build image (pulls docs at build time)
                   └─ repository_dispatch: deploy-nuxt ──▶ launch-deploy
                              └─ kamal rolls out the new image
```
