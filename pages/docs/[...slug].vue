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

    <!-- Content -->
    <ContentDoc :path="`/docs/${slug}`">
      <template #default="{ doc }">
        <!-- Page header -->
        <div class="mb-8">
          <h1 class="text-3xl font-bold tracking-tight text-foreground">
            {{ doc.title }}
          </h1>
          <p v-if="doc.description" class="mt-2 text-lg text-muted-foreground">
            {{ doc.description }}
          </p>
        </div>

        <!-- Rendered content -->
        <article class="prose prose-neutral dark:prose-invert max-w-none">
          <ContentRenderer :value="doc" />
        </article>
      </template>

      <template #not-found>
        <div class="text-center py-12">
          <h1 class="text-2xl font-bold text-foreground mb-4">Page not found</h1>
          <p class="text-muted-foreground mb-6">The documentation page you're looking for doesn't exist.</p>
          <NuxtLink to="/docs/overview" class="text-primary hover:underline">
            Go to Overview
          </NuxtLink>
        </div>
      </template>
    </ContentDoc>
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
