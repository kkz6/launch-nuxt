<script setup lang="ts">
definePageMeta({
  layout: 'docs',
})

const route = useRoute()
const slug = computed(() => {
  const parts = route.params.slug
  const joined = Array.isArray(parts) ? parts.join('/') : parts || ''
  return joined
})
const docPath = computed(() => (slug.value ? `/docs/${slug.value}` : '/docs'))

const { data: page } = await useAsyncData(`docs-${slug.value || 'index'}`, () =>
  queryCollection('docs').path(docPath.value).first()
)

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
  })
}

useHead({
  title: page.value?.title ? `${page.value.title} - Docs` : 'Documentation',
  meta: [
    { name: 'description', content: page.value?.description || 'launchctl documentation' },
  ],
})

// Extract TOC from page
const toc = computed(() => {
  if (!page.value?.body?.toc?.links) return []
  return page.value.body.toc.links
})

// Provide TOC to layout
provide('docsToc', toc)

// Mono breadcrumb eyebrow, e.g. "application / servers", matching the CLI motif.
const breadcrumb = computed(() =>
  slug.value
    ? slug.value.split('/').map((s) => s.replace(/-/g, ' '))
    : ['docs']
)
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <!-- Page header -->
    <div v-if="page" class="mb-8">
      <div class="mb-3 flex items-center gap-1.5 font-mono text-xs text-[hsl(var(--site-text-muted))]">
        <span class="text-[hsl(var(--site-accent))]">~</span>
        <template v-for="(crumb, i) in breadcrumb" :key="i">
          <span v-if="i > 0" class="text-[hsl(var(--site-text-muted))]/50">/</span>
          <span>{{ crumb }}</span>
        </template>
      </div>
      <h1 class="text-3xl font-bold tracking-tight text-[hsl(var(--site-text))]">
        {{ page.title }}
      </h1>
      <p v-if="page.description" class="mt-3 text-base leading-relaxed text-[hsl(var(--site-text-muted))]">
        {{ page.description }}
      </p>
    </div>

    <!-- Content -->
    <article v-if="page" class="docs-content">
      <ContentRenderer :value="page" />
    </article>
  </div>
</template>

<style>
.docs-content {
  color: hsl(var(--site-text));
}

/* Headings */
.docs-content h1 {
  @apply mb-6 mt-10 text-3xl font-bold tracking-tight first:mt-0;
  color: hsl(var(--site-text));
}

.docs-content h2 {
  @apply mb-4 mt-12 scroll-mt-20 pb-2 text-2xl font-semibold tracking-tight first:mt-0;
  color: hsl(var(--site-text));
  border-bottom: 1px solid hsl(var(--site-border));
}

.docs-content h3 {
  @apply mb-3 mt-8 scroll-mt-20 text-xl font-semibold tracking-tight;
  color: hsl(var(--site-text));
}

.docs-content h4 {
  @apply mb-2 mt-6 scroll-mt-20 text-lg font-semibold tracking-tight;
  color: hsl(var(--site-text));
}

/* Paragraphs */
.docs-content p {
  @apply mb-4 leading-7;
  color: hsl(var(--site-text-muted));
}

/* Lists */
.docs-content ul {
  @apply mb-6 ml-6 list-disc space-y-2;
}

.docs-content ol {
  @apply mb-6 ml-6 list-decimal space-y-2;
}

.docs-content li {
  @apply leading-7;
  color: hsl(var(--site-text-muted));
}

.docs-content li::marker {
  color: hsl(var(--site-accent));
}

.docs-content li > ul,
.docs-content li > ol {
  @apply mt-2 mb-0;
}

/* Links — only inline links inside running text get the accent + underline.
   Block links (doc cards) and heading anchor links are left alone. */
.docs-content :is(p, li, td, blockquote) a {
  @apply font-medium underline underline-offset-4 transition-colors;
  color: hsl(var(--site-accent));
  text-decoration-color: hsl(var(--site-accent) / 0.4);
}

.docs-content :is(p, li, td, blockquote) a:hover {
  text-decoration-color: hsl(var(--site-accent));
}

/* Heading anchor links (added by @nuxt/content) should look like the heading. */
.docs-content :is(h1, h2, h3, h4) a {
  color: inherit;
  font-weight: inherit;
  text-decoration: none;
}

/* Code - inline */
.docs-content :not(pre) > code {
  @apply rounded-md px-1.5 py-0.5 font-mono text-[0.85em];
  background: hsl(var(--site-surface));
  border: 1px solid hsl(var(--site-border));
  color: hsl(var(--site-text));
}

/* Code - blocks: always-dark terminal panels, like the landing */
.docs-content pre {
  @apply mb-6 overflow-x-auto rounded-lg p-4 font-mono text-sm;
  background: #0b0e14;
  border: 1px solid hsl(220 10% 18%);
}

.docs-content pre code {
  @apply bg-transparent p-0;
  color: #e3e8ef;
}

/* Blockquotes */
.docs-content blockquote {
  @apply mb-6 rounded-lg py-3 pl-4 pr-4 not-italic;
  border-left: 3px solid hsl(var(--site-accent));
  background: hsl(var(--site-surface));
}

.docs-content blockquote p {
  @apply mb-0;
  color: hsl(var(--site-text));
}

/* Tables */
.docs-content table {
  @apply mb-6 w-full border-collapse overflow-hidden rounded-lg text-sm;
  border: 1px solid hsl(var(--site-border));
}

.docs-content thead {
  background: hsl(var(--site-surface));
}

.docs-content th {
  @apply px-4 py-3 text-left font-mono text-xs font-semibold uppercase tracking-wider;
  color: hsl(var(--site-text));
}

.docs-content td {
  @apply px-4 py-3;
  border-top: 1px solid hsl(var(--site-border));
  color: hsl(var(--site-text-muted));
}

.docs-content tbody tr:hover {
  background: hsl(var(--site-surface) / 0.5);
}

/* Horizontal rules */
.docs-content hr {
  @apply my-10;
  border-top: 1px solid hsl(var(--site-border));
}

/* Strong and emphasis */
.docs-content strong {
  @apply font-semibold;
  color: hsl(var(--site-text));
}

.docs-content em {
  @apply italic;
}

/* Images */
.docs-content img {
  @apply my-6 rounded-lg;
  border: 1px solid hsl(var(--site-border));
}
</style>
