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

const { data: page } = await useAsyncData(`docs-${slug.value}`, () => {
  return queryContent('docs', slug.value).findOne()
})

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

const toc = computed(() => page.value?.body?.toc?.links || [])
</script>

<template>
  <div>
    <!-- Mobile navigation -->
    <div class="mb-6 lg:hidden">
      <details class="rounded-lg border bg-card">
        <summary class="cursor-pointer px-4 py-3 text-sm font-medium text-foreground">
          Navigation
        </summary>
        <nav class="border-t px-4 py-3">
          <ul class="space-y-1">
            <li>
              <NuxtLink
                to="/docs/overview"
                class="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Overview
              </NuxtLink>
            </li>
            <li>
              <NuxtLink
                to="/docs/servers"
                class="block rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                Servers
              </NuxtLink>
            </li>
          </ul>
        </nav>
      </details>
    </div>

    <!-- Page header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ page?.title }}
      </h1>
      <p v-if="page?.description" class="mt-2 text-lg text-muted-foreground">
        {{ page?.description }}
      </p>
    </div>

    <!-- Content -->
    <article class="prose prose-neutral dark:prose-invert max-w-none">
      <ContentRenderer v-if="page" :value="page" />
    </article>

    <!-- Table of Contents (inline for now) -->
    <div v-if="toc.length > 0" class="mt-12 border-t pt-8 xl:hidden">
      <h4 class="mb-3 text-sm font-semibold text-foreground">On this page</h4>
      <nav class="space-y-1">
        <a
          v-for="link in toc"
          :key="link.id"
          :href="`#${link.id}`"
          class="block text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          {{ link.text }}
        </a>
      </nav>
    </div>
  </div>
</template>

<style>
.prose h2 {
  @apply mt-10 scroll-mt-20 border-b pb-2 text-2xl font-semibold tracking-tight first:mt-0;
}

.prose h3 {
  @apply mt-8 scroll-mt-20 text-xl font-semibold tracking-tight;
}

.prose h4 {
  @apply mt-6 scroll-mt-20 text-lg font-semibold tracking-tight;
}

.prose p {
  @apply leading-7 [&:not(:first-child)]:mt-4;
}

.prose ul {
  @apply my-4 ml-6 list-disc [&>li]:mt-2;
}

.prose ol {
  @apply my-4 ml-6 list-decimal [&>li]:mt-2;
}

.prose li {
  @apply text-muted-foreground;
}

.prose a {
  @apply font-medium text-primary underline underline-offset-4 hover:text-primary/80;
}

.prose code {
  @apply relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm;
}

.prose pre {
  @apply my-4 overflow-x-auto rounded-lg border bg-muted p-4;
}

.prose pre code {
  @apply bg-transparent p-0;
}

.prose blockquote {
  @apply mt-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground;
}

.prose table {
  @apply my-4 w-full border-collapse;
}

.prose th {
  @apply border-b bg-muted px-4 py-2 text-left text-sm font-semibold text-foreground;
}

.prose td {
  @apply border-b px-4 py-2 text-sm text-muted-foreground;
}

.prose hr {
  @apply my-8 border-t;
}

.prose strong {
  @apply font-semibold text-foreground;
}
</style>
