<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'
import type { Site } from '~/types'

definePageMeta({
  middleware: 'auth',
})

useHead({
  title: 'Sites',
})

const sites = ref<Site[]>([])
const isLoading = ref(true)

onMounted(async () => {
  try {
    const response = await $api<{ data: Site[] }>('/sites')
    sites.value = response.data
  } catch {
    // Handle error
  } finally {
    isLoading.value = false
  }
})
</script>

<template>
  <div class="space-y-8">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Sites</h1>
        <p class="text-muted-foreground">Manage your deployed sites</p>
      </div>
      <Button as-child>
        <NuxtLink to="/sites/create">
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Site
        </NuxtLink>
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="sites.length === 0" class="flex flex-col items-center justify-center py-12">
      <Icon name="lucide:globe" class="mb-4 h-12 w-12 text-muted-foreground" />
      <h3 class="text-lg font-semibold">No sites yet</h3>
      <p class="mb-4 text-muted-foreground">Get started by creating your first site</p>
      <Button as-child>
        <NuxtLink to="/sites/create">Create Site</NuxtLink>
      </Button>
    </div>

    <div v-else class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <Card v-for="site in sites" :key="site.id">
        <CardHeader>
          <div class="flex items-center justify-between">
            <CardTitle class="text-lg">{{ site.name }}</CardTitle>
            <span
              :class="[
                'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                site.installed_at
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
              ]"
            >
              {{ site.installed_at ? 'Active' : 'Installing' }}
            </span>
          </div>
          <CardDescription>{{ site.address }}</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-between text-sm">
            <span class="text-muted-foreground">{{ site.type }}</span>
            <a
              :href="site.url"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
            >
              Visit
              <Icon name="lucide:external-link" class="ml-1 inline h-3 w-3" />
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
