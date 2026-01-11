<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card, CardContent, CardHeader, CardTitle } from '~/components/ui/card'
import { Badge } from '~/components/ui/badge'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'DNS Domains' })

interface Domain {
  id: string
  label: string
  address: string
  provider?: {
    provider: string
    provider_label: string
  }
  status?: string
}

const domains = ref<Domain[]>([])
const providers = ref<Record<string, string>>({})
const isLoading = ref(true)

const fetchDomains = async () => {
  try {
    const data = await $api<{ data: Domain[]; providers: Record<string, string> }>('/dns/domains')
    domains.value = data.data
    providers.value = data.providers
  } catch {
    toast.error('Failed to load domains')
  } finally {
    isLoading.value = false
  }
}

onMounted(fetchDomains)
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold">DNS Domains</h1>
        <p class="text-muted-foreground">Manage your DNS domains and records</p>
      </div>
      <DnsAddDomain :providers="providers" @created="fetchDomains" />
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <div v-else-if="domains.length === 0" class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4">
      <Icon name="lucide:globe" class="h-24 w-24 text-muted-foreground" />
      <span class="text-muted-foreground">No domains configured yet</span>
      <DnsAddDomain :providers="providers" @created="fetchDomains" />
    </div>

    <div v-else class="grid w-full gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="domain in domains"
        :key="domain.id"
        :to="`/dns/${domain.id}`"
        class="w-full lg:max-w-md"
      >
        <Card class="group relative w-full bg-transparent transition-colors hover:bg-card">
          <CardHeader>
            <CardTitle class="relative flex items-start justify-between gap-2">
              <div class="flex flex-1 flex-col gap-1.5">
                <div class="flex items-center gap-2">
                  <Icon name="lucide:globe" class="h-4 w-4 text-muted-foreground" />
                  <span class="text-base font-medium leading-none">
                    {{ domain.label }}
                  </span>
                </div>
                <span class="text-sm font-medium text-muted-foreground">
                  {{ domain.provider?.provider_label || 'Provider' }}
                </span>
                <span class="text-sm font-medium text-muted-foreground">
                  {{ domain.address }}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent class="pt-4">
            <Badge v-if="domain.status" :variant="domain.status === 'active' ? 'default' : 'secondary'">
              {{ domain.status }}
            </Badge>
          </CardContent>
        </Card>
      </NuxtLink>
    </div>
  </div>
</template>
