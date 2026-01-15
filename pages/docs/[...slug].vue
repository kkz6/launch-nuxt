<script setup lang="ts">
definePageMeta({
  layout: 'docs',
})

const route = useRoute()
const slug = computed(() => {
  const parts = route.params.slug
  if (Array.isArray(parts)) {
    return parts.join('/')
  }
  return parts || 'overview'
})

const { data: page } = await useAsyncData(`docs-${slug.value}`, () =>
  queryCollection('docs').path(`/docs/${slug.value}`).first()
)

if (!page.value) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Page not found',
  })
}

useHead({
  title: page.value?.title ? `${page.value.title} - launchctl Docs` : 'Documentation - launchctl',
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
</script>

<template>
  <div>
    <!-- Page header -->
    <div v-if="page" class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ page.title }}
      </h1>
      <p v-if="page.description" class="mt-3 text-base leading-relaxed text-muted-foreground">
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
  @apply text-foreground;
}

/* Headings */
.docs-content h1 {
  @apply mb-6 mt-10 text-3xl font-bold tracking-tight text-foreground first:mt-0;
}

.docs-content h2 {
  @apply mb-4 mt-12 scroll-mt-20 border-b pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0;
}

.docs-content h3 {
  @apply mb-3 mt-8 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground;
}

.docs-content h4 {
  @apply mb-2 mt-6 scroll-mt-20 text-lg font-semibold tracking-tight text-foreground;
}

/* Paragraphs */
.docs-content p {
  @apply mb-4 leading-7 text-muted-foreground;
}

/* Lists */
.docs-content ul {
  @apply mb-6 ml-6 list-disc space-y-2;
}

.docs-content ol {
  @apply mb-6 ml-6 list-decimal space-y-2;
}

.docs-content li {
  @apply leading-7 text-muted-foreground;
}

.docs-content li > ul,
.docs-content li > ol {
  @apply mt-2 mb-0;
}

/* Links */
.docs-content a {
  @apply font-medium text-primary underline decoration-primary/30 underline-offset-4 transition-colors hover:decoration-primary;
}

/* Code - inline */
.docs-content code {
  @apply rounded-md bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground;
}

/* Code - blocks */
.docs-content pre {
  @apply mb-6 overflow-x-auto rounded-lg border bg-zinc-950 p-4 dark:bg-zinc-900;
}

.docs-content pre code {
  @apply bg-transparent p-0 text-zinc-100;
}

/* Blockquotes */
.docs-content blockquote {
  @apply mb-6 rounded-lg border-l-4 border-primary/50 bg-muted/50 py-3 pl-4 pr-4 not-italic;
}

.docs-content blockquote p {
  @apply mb-0 text-foreground;
}

/* Tables */
.docs-content table {
  @apply mb-6 w-full border-collapse overflow-hidden rounded-lg border text-sm;
}

.docs-content thead {
  @apply bg-muted;
}

.docs-content th {
  @apply px-4 py-3 text-left font-semibold text-foreground;
}

.docs-content td {
  @apply border-t px-4 py-3 text-muted-foreground;
}

.docs-content tbody tr:hover {
  @apply bg-muted/50;
}

/* Horizontal rules */
.docs-content hr {
  @apply my-10 border-t border-border;
}

/* Strong and emphasis */
.docs-content strong {
  @apply font-semibold text-foreground;
}

.docs-content em {
  @apply italic;
}

/* Images */
.docs-content img {
  @apply my-6 rounded-lg border;
}
</style>
