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
</script>

<template>
  <div>
    <!-- Mobile navigation -->
    <div class="mb-6 lg:hidden">
      <details class="rounded-lg border bg-card">
        <summary class="flex cursor-pointer items-center gap-2 px-4 py-3 text-sm font-medium text-foreground">
          <Icon name="lucide:menu" class="h-4 w-4" />
          Navigation
        </summary>
        <nav class="border-t px-4 py-3">
          <ul class="space-y-1">
            <li>
              <NuxtLink
                to="/docs/overview"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon name="lucide:book-open" class="h-4 w-4" />
                Overview
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/docs/servers"
                class="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Icon name="lucide:server" class="h-4 w-4" />
                Servers
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </details>
    </div>

    <!-- Page header -->
    <div v-if="page" class="mb-8 border-b pb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ page.title }}
      </h1>
      <p v-if="page.description" class="mt-3 text-lg text-muted-foreground">
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
  @apply mb-4 mt-8 text-3xl font-bold tracking-tight text-foreground first:mt-0;
}

.docs-content h2 {
  @apply mb-4 mt-10 border-b pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0;
}

.docs-content h3 {
  @apply mb-3 mt-8 text-xl font-semibold tracking-tight text-foreground;
}

.docs-content h4 {
  @apply mb-2 mt-6 text-lg font-semibold tracking-tight text-foreground;
}

/* Paragraphs */
.docs-content p {
  @apply mb-4 leading-7 text-muted-foreground;
}

/* Lists */
.docs-content ul {
  @apply mb-4 ml-6 list-disc space-y-2;
}

.docs-content ol {
  @apply mb-4 ml-6 list-decimal space-y-2;
}

.docs-content li {
  @apply text-muted-foreground;
}

.docs-content li > ul,
.docs-content li > ol {
  @apply mt-2;
}

/* Links */
.docs-content a {
  @apply font-medium text-primary underline underline-offset-4 hover:text-primary/80;
}

/* Code */
.docs-content code {
  @apply rounded bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground;
}

.docs-content pre {
  @apply mb-4 overflow-x-auto rounded-lg border bg-muted p-4;
}

.docs-content pre code {
  @apply bg-transparent p-0;
}

/* Blockquotes */
.docs-content blockquote {
  @apply mb-4 border-l-4 border-border pl-4 italic text-muted-foreground;
}

/* Tables */
.docs-content table {
  @apply mb-4 w-full border-collapse overflow-hidden rounded-lg border;
}

.docs-content th {
  @apply bg-muted px-4 py-3 text-left text-sm font-semibold text-foreground;
}

.docs-content td {
  @apply border-t px-4 py-3 text-sm text-muted-foreground;
}

.docs-content tr:hover td {
  @apply bg-muted/50;
}

/* Horizontal rules */
.docs-content hr {
  @apply my-8 border-t border-border;
}

/* Strong and emphasis */
.docs-content strong {
  @apply font-semibold text-foreground;
}

.docs-content em {
  @apply italic;
}
</style>
