<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '~/components/ui/tabs'
import { Badge } from '~/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '~/components/ui/card'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from '~/components/ui/breadcrumb'

definePageMeta({
  layout: 'default',
  middleware: 'auth',
})

interface DnsRecord {
  id: string
  type: string
  name: string
  value: string
  ttl?: number
  priority?: number
  tag?: string
  weight?: number
  port?: number
  flags?: number
  comment?: string
  proxied?: boolean
}

interface Domain {
  id: string
  label: string
  address: string
  provider?: {
    provider: string
    provider_label: string
  }
}

const route = useRoute()
const domainId = computed(() => route.params.id as string)

const domain = ref<Domain | null>(null)
const records = ref<DnsRecord[]>([])
const recordTypes = ref<string[]>([])
const isLoading = ref(true)
const activeTab = ref('')
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const recordsByType = computed(() => {
  const grouped: Record<string, DnsRecord[]> = {}
  recordTypes.value.forEach((type) => {
    grouped[type] = records.value.filter((r) => r.type === type)
  })
  return grouped
})

const availableRecordTypes = computed(() =>
  recordTypes.value.filter((type) => (recordsByType.value[type]?.length || 0) > 0)
)

const fetchDomainData = async () => {
  try {
    const data = await $api<{
      domain: Domain
      records: DnsRecord[]
      recordTypes: string[]
    }>(`/dns/domains/${domainId.value}`)
    domain.value = data.domain
    records.value = data.records
    recordTypes.value = data.recordTypes
    if (availableRecordTypes.value.length > 0 && !activeTab.value) {
      activeTab.value = availableRecordTypes.value[0]
    }
    useHead({ title: domain.value?.label || 'DNS Domain' })
  } catch {
    toast.error('Failed to load domain data')
    navigateTo('/dns')
  } finally {
    isLoading.value = false
  }
}

const deleteRecord = async (record: DnsRecord) => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: `Delete ${record.type} Record`,
    description: `Are you sure you want to delete the ${record.type} record for "${record.name}"?`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api(`/dns/domains/${domainId.value}/records/${record.id}`, {
        method: 'DELETE',
      })
      records.value = records.value.filter((r) => r.id !== record.id)
      toast.success('Record deleted')
    } catch {
      toast.error('Failed to delete record')
    }
  }
}

const getColumnsForType = (type: string) => {
  const columns = [
    { key: 'name', label: 'Name', width: '20%' },
    { key: 'value', label: 'Value', width: '25%' },
    { key: 'ttl', label: 'TTL', width: '15%' },
  ]

  if (type === 'MX') {
    columns.push({ key: 'priority', label: 'Priority', width: '10%' })
  }

  if (type === 'SRV') {
    columns.push(
      { key: 'priority', label: 'Priority', width: '10%' },
      { key: 'weight', label: 'Weight', width: '10%' },
      { key: 'port', label: 'Port', width: '10%' }
    )
  }

  if (type === 'CAA') {
    columns.push(
      { key: 'flags', label: 'Flags', width: '10%' },
      { key: 'tag', label: 'Tag', width: '10%' }
    )
  }

  columns.push({ key: 'comment', label: 'Comment', width: '20%' })

  return columns
}

const isCloudflare = computed(() => domain.value?.provider?.provider === 'cloudflare')

onMounted(fetchDomainData)
</script>

<template>
  <div class="pb-10">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else-if="domain">
      <div class="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <NuxtLink to="/dns">DNS Domains</NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink>{{ domain.address }}</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header class="mb-6 flex w-full items-center justify-between gap-4 max-sm:flex-wrap">
          <div class="flex w-fit flex-col justify-between gap-2">
            <div class="flex flex-row flex-wrap items-center gap-2 xl:gap-4">
              <h1 class="flex items-center gap-2 text-xl font-bold lg:text-3xl">
                {{ domain.label }}
                <a
                  :href="`https://${domain.address}`"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon name="lucide:external-link" class="h-5 w-5" />
                </a>
              </h1>
            </div>
            <div v-if="domain.provider" class="flex h-fit w-fit flex-row gap-2">
              <Badge>{{ domain.provider.provider_label }}</Badge>
            </div>
          </div>
        </header>
      </div>

      <Tabs v-model="activeTab" class="w-full">
        <div class="flex w-full items-center justify-between gap-4">
          <div class="relative min-w-0 flex-1">
            <div class="w-full overflow-x-auto whitespace-nowrap">
              <TabsList class="mb-3 flex h-auto min-w-max justify-start bg-background p-0">
                <TabsTrigger
                  v-for="type in availableRecordTypes"
                  :key="type"
                  :value="type"
                  class="relative w-[120px] overflow-hidden whitespace-nowrap rounded-none border border-border py-2 shadow-sm shadow-black/5 first:rounded-s last:rounded-e data-[state=active]:bg-muted data-[state=active]:after:bg-primary after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5"
                >
                  {{ type }}
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  class="relative w-[120px] overflow-hidden whitespace-nowrap rounded-none border border-border py-2 shadow-sm shadow-black/5 first:rounded-s last:rounded-e data-[state=active]:bg-muted data-[state=active]:after:bg-primary after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-0.5"
                >
                  Settings
                </TabsTrigger>
              </TabsList>
            </div>
          </div>
          <DnsRecordModal
            :domain="domain"
            :available-record-types="recordTypes.filter((t) => t !== 'NS')"
            :is-cloudflare="isCloudflare"
            @created="fetchDomainData"
          />
        </div>

        <TabsContent v-for="type in availableRecordTypes" :key="type" :value="type">
          <Card class="bg-background">
            <CardHeader>
              <CardTitle class="text-xl">{{ type }} Records</CardTitle>
              <CardDescription>
                Manage {{ type }} records for {{ domain.label }}
              </CardDescription>
            </CardHeader>
            <CardContent class="flex flex-col gap-4">
              <SharedDataTable
                :data="recordsByType[type] || []"
                :columns="getColumnsForType(type)"
                :actions="
                  type === 'NS'
                    ? []
                    : [
                        {
                          label: 'Delete',
                          icon: 'lucide:trash-2',
                          onClick: deleteRecord,
                          destructive: true,
                        },
                      ]
                "
                :empty-title="`No ${type} records found`"
              >
                <template #cell-name="{ row }">
                  <div class="flex items-center gap-2">
                    <span>{{ row.name }}</span>
                    <Icon
                      v-if="row.proxied"
                      name="lucide:shield"
                      class="h-4 w-4 text-orange-500"
                      title="Proxied through Cloudflare"
                    />
                  </div>
                </template>

                <template #cell-ttl="{ row }">
                  <span v-if="row.proxied && row.ttl === 1">Auto</span>
                  <span v-else-if="row.ttl && row.ttl > 0">{{ row.ttl }}</span>
                  <span v-else>-</span>
                </template>

                <template #cell-priority="{ row }">
                  {{ row.priority ?? '-' }}
                </template>

                <template #cell-weight="{ row }">
                  {{ row.weight ?? '-' }}
                </template>

                <template #cell-port="{ row }">
                  {{ row.port ?? '-' }}
                </template>

                <template #cell-flags="{ row }">
                  {{ row.flags ?? '-' }}
                </template>

                <template #cell-tag="{ row }">
                  {{ row.tag ?? '-' }}
                </template>

                <template #cell-comment="{ row }">
                  {{ row.comment || '-' }}
                </template>
              </SharedDataTable>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings">
          <DnsDomainSettings :domain="domain" @deleted="navigateTo('/dns')" @updated="fetchDomainData" />
        </TabsContent>
      </Tabs>
    </template>
  </div>
</template>
