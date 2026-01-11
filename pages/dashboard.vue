<script setup lang="ts">
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '~/components/ui/card'

definePageMeta({
  middleware: 'auth',
})

useHead({
  title: 'Dashboard',
})

const { user } = useAuth()

// Placeholder stats - these would come from your API
const stats = ref([
  { name: 'Servers', value: '0', icon: 'lucide:server' },
  { name: 'Sites', value: '0', icon: 'lucide:globe' },
  { name: 'Deployments', value: '0', icon: 'lucide:rocket' },
  { name: 'Databases', value: '0', icon: 'lucide:database' },
])
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-3xl font-bold tracking-tight">Dashboard</h1>
      <p class="text-muted-foreground">
        Welcome back, {{ user?.name }}
      </p>
    </div>

    <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.name">
        <CardHeader class="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle class="text-sm font-medium">{{ stat.name }}</CardTitle>
          <Icon :name="stat.icon" class="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stat.value }}</div>
        </CardContent>
      </Card>
    </div>

    <div class="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Your recent deployments and server activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div class="flex items-center justify-center py-8 text-muted-foreground">
            <p>No recent activity</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>Common tasks and shortcuts</CardDescription>
        </CardHeader>
        <CardContent class="grid gap-2">
          <NuxtLink
            to="/servers/create"
            class="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
          >
            <Icon name="lucide:plus" class="h-4 w-4" />
            <span>Create Server</span>
          </NuxtLink>
          <NuxtLink
            to="/sites/create"
            class="flex items-center gap-2 rounded-md p-2 hover:bg-accent"
          >
            <Icon name="lucide:plus" class="h-4 w-4" />
            <span>Create Site</span>
          </NuxtLink>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
