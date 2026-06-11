import { defineContentConfig, defineCollection } from '@nuxt/content'

// Docs content can come from one of two places:
//
//   • Local (default) — markdown in this repo under content/docs/**.
//     Used for local development and as a fallback.
//
//   • A dedicated GitHub repo — set NUXT_CONTENT_DOCS_REPO to a repo URL
//     (e.g. https://github.com/kkz6/launchctl-docs) and @nuxt/content pulls
//     the markdown from it. For a PRIVATE repo, also set
//     NUXT_CONTENT_GITHUB_TOKEN.
//
// IMPORTANT: the remote repo is fetched at BUILD TIME and baked into the
// build, so a docs change only appears after the site is rebuilt. Wire the
// docs repo to trigger a rebuild on push (see docs/CONTENT_FROM_GITHUB.md).
const docsRepo = process.env.NUXT_CONTENT_DOCS_REPO?.trim()
const docsToken = process.env.NUXT_CONTENT_GITHUB_TOKEN?.trim()

export default defineContentConfig({
  collections: {
    docs: defineCollection({
      type: 'page',
      source: docsRepo
        ? {
            repository: docsRepo,
            include: 'docs/**/*.md',
            ...(docsToken ? { authToken: docsToken } : {}),
          }
        : 'docs/**/*.md',
    }),
  },
})
