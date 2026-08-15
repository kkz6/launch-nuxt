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
  <div class="mx-auto max-w-[49rem]">
    <!-- Page header -->
    <div v-if="page" class="relative mb-10 overflow-hidden border-b border-[hsl(var(--site-border))] pb-9">
      <div class="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-[hsl(var(--site-accent))]/10 blur-3xl" />
      <div class="relative mb-5 flex items-center gap-1.5 font-docs-mono text-[11px] uppercase tracking-[0.12em] text-[hsl(var(--site-text-muted))]">
        <span class="text-[hsl(var(--site-accent))]">~</span>
        <template v-for="(crumb, i) in breadcrumb" :key="i">
          <span v-if="i > 0" class="text-[hsl(var(--site-text-muted))]/50">/</span>
          <span>{{ crumb }}</span>
        </template>
      </div>
      <h1 class="relative max-w-3xl text-4xl font-bold leading-[1.08] tracking-[-0.045em] text-[hsl(var(--site-text))] md:text-5xl">
        {{ page.title }}
      </h1>
      <p v-if="page.description" class="relative mt-5 max-w-2xl text-lg leading-8 text-[hsl(var(--site-text-muted))]">
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
  @apply mb-6 mt-10 text-3xl font-bold tracking-[-0.035em] first:mt-0;
  color: hsl(var(--site-text));
}

.docs-content h2 {
  @apply mb-4 mt-14 scroll-mt-24 pb-3 text-2xl font-semibold tracking-[-0.03em] first:mt-0;
  color: hsl(var(--site-text));
  border-bottom: 1px solid hsl(var(--site-border));
}

.docs-content h3 {
  @apply mb-3 mt-9 scroll-mt-24 text-xl font-semibold tracking-[-0.02em];
  color: hsl(var(--site-text));
}

.docs-content h4 {
  @apply mb-2 mt-6 scroll-mt-20 text-lg font-semibold tracking-tight;
  color: hsl(var(--site-text));
}

/* Paragraphs */
.docs-content p {
  @apply mb-5 text-[15px] leading-7;
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
  @apply rounded-md px-1.5 py-0.5 font-docs-mono text-[0.82em];
  background: hsl(var(--site-surface));
  border: 1px solid hsl(var(--site-border));
  color: hsl(var(--site-text));
}

/* Code - blocks: always-dark terminal panels, like the landing */
.docs-content pre {
  @apply mb-7 overflow-x-auto rounded-xl p-5 font-docs-mono text-[13px] leading-6;
  background: linear-gradient(145deg, #0b1018, #0c111b 60%, #101722);
  border: 1px solid hsl(220 12% 20%);
  box-shadow: 0 22px 55px -32px rgb(2 6 23 / 0.8), inset 0 1px 0 rgb(255 255 255 / 0.04);
}

.docs-content pre code {
  @apply bg-transparent p-0;
  color: #e3e8ef;
}

/* Blockquotes */
.docs-content blockquote {
  @apply mb-7 rounded-xl py-4 pl-5 pr-5 not-italic;
  border-left: 3px solid hsl(var(--site-accent));
  background: hsl(var(--site-surface));
}

.docs-content blockquote p {
  @apply mb-0;
  color: hsl(var(--site-text));
}

/* Tables */
.docs-content table {
  @apply mb-7 w-full border-collapse overflow-hidden rounded-xl text-sm;
  border: 1px solid hsl(var(--site-border));
}

.docs-content thead {
  background: hsl(var(--site-surface));
}

.docs-content th {
  @apply px-4 py-3 text-left font-docs-mono text-[10px] font-semibold uppercase tracking-[0.12em];
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
