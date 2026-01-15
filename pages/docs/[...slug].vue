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
    <div v-if="page" class="mb-8">
      <h1 class="text-3xl font-bold tracking-tight text-foreground">
        {{ page.title }}
      </h1>
      <p v-if="page.description" class="mt-2 text-lg text-muted-foreground">
        {{ page.description }}
      </p>
    </div>

    <!-- Content -->
    <article v-if="page" class="prose-content">
      <ContentRenderer :value="page" />
    </article>
  </div>
</template>

<style>
.prose-content {
  @apply max-w-none;
}

.prose-content :deep(h2) {
  @apply mt-10 scroll-mt-20 border-b pb-2 text-2xl font-semibold tracking-tight text-foreground first:mt-0;
}

.prose-content :deep(h3) {
  @apply mt-8 scroll-mt-20 text-xl font-semibold tracking-tight text-foreground;
}

.prose-content :deep(h4) {
  @apply mt-6 scroll-mt-20 text-lg font-semibold tracking-tight text-foreground;
}

.prose-content :deep(p) {
  @apply leading-7 text-muted-foreground [&:not(:first-child)]:mt-4;
}

.prose-content :deep(ul) {
  @apply my-4 ml-6 list-disc [&>li]:mt-2;
}

.prose-content :deep(ol) {
  @apply my-4 ml-6 list-decimal [&>li]:mt-2;
}

.prose-content :deep(li) {
  @apply text-muted-foreground;
}

.prose-content :deep(a) {
  @apply font-medium text-primary underline underline-offset-4 hover:text-primary/80;
}

.prose-content :deep(code) {
  @apply relative rounded bg-muted px-[0.3rem] py-[0.2rem] font-mono text-sm;
}

.prose-content :deep(pre) {
  @apply my-4 overflow-x-auto rounded-lg border bg-muted p-4;
}

.prose-content :deep(pre code) {
  @apply bg-transparent p-0;
}

.prose-content :deep(blockquote) {
  @apply mt-4 border-l-4 border-primary/30 pl-4 italic text-muted-foreground;
}

.prose-content :deep(table) {
  @apply my-4 w-full border-collapse;
}

.prose-content :deep(th) {
  @apply border-b bg-muted px-4 py-2 text-left text-sm font-semibold text-foreground;
}

.prose-content :deep(td) {
  @apply border-b px-4 py-2 text-sm text-muted-foreground;
}

.prose-content :deep(hr) {
  @apply my-8 border-t;
}

.prose-content :deep(strong) {
  @apply font-semibold text-foreground;
}
</style>
