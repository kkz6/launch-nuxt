<script setup lang="ts">
import { Globe } from "lucide-vue-next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({ title: "Domains" });

interface DnsProvider {
  id: string;
  provider: string;
  label: string;
}

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
}

interface Domain {
  id: string;
  label: string;
  address: string;
  provider?: {
    provider: string;
    provider_label: string;
  };
  records?: DnsRecord[];
  records_count?: number;
  created_at: string;
}

interface DomainsResponse {
  success: boolean;
  message: string;
  data: {
    data: Domain[];
    providers: DnsProvider[];
  };
}

const domains = ref<Domain[]>([]);
const providers = ref<DnsProvider[]>([]);
const isLoading = ref(true);

// Watch for refresh trigger from navbar
const dnsRefreshKey = useState('dnsRefreshKey', () => 0);
watch(dnsRefreshKey, () => {
  fetchDomains();
});

const fetchDomains = async () => {
  try {
    const response = await $api<DomainsResponse>("/dns/domains");
    domains.value = response.data.data;
    providers.value = response.data.providers;
  } catch {
    toast.error("Failed to load domains");
  } finally {
    isLoading.value = false;
  }
};

const getRecordCount = (domain: Domain): number => {
  return domain.records_count ?? domain.records?.length ?? 0;
};

const formatCreatedDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

const getProviderLabel = (domain: Domain): string => {
  // If provider_label is available on the domain's provider object
  if (domain.provider?.provider_label) {
    return domain.provider.provider_label;
  }

  // Look up from providers list using provider ID or provider key
  const providerId = typeof domain.provider === 'string'
    ? domain.provider
    : domain.provider?.provider;

  if (providerId) {
    const found = providers.value.find(
      (p) => p.id === providerId || p.provider === providerId
    );
    if (found) return found.label;
  }

  return "Unknown Provider";
};

onMounted(fetchDomains);
</script>

<template>
  <div>
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="domains.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4"
    >
      <Globe class="size-10 text-muted-foreground md:size-28" />
      <span>No domains configured yet. Click on Add Domain.</span>
    </div>

    <div
      v-else
      class="grid w-full gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3"
    >
            <NuxtLink
              v-for="domain in domains"
              :key="domain.id"
              :to="`/dns/${domain.id}`"
              class="w-full lg:max-w-md"
            >
              <Card
                class="group relative w-full bg-transparent transition-colors hover:bg-card"
              >
                <CardHeader>
                  <CardTitle
                    class="relative flex items-start justify-between gap-2"
                  >
                    <div class="flex flex-1 flex-col gap-1.5">
                      <div class="flex items-center gap-2">
                        <Globe class="h-4 w-4 text-muted-foreground" />
                        <span class="text-base font-medium leading-none">
                          {{ domain.label }}
                        </span>
                      </div>
                      <span class="text-sm font-medium text-muted-foreground">
                        {{ getProviderLabel(domain) }}
                      </span>
                      <span class="text-sm font-medium text-muted-foreground">
                        {{ domain.address }}
                      </span>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent class="pt-4">
                  <div
                    class="flex w-full flex-row justify-between gap-2 text-sm max-sm:flex-wrap sm:gap-4"
                  >
                    <div class="flex flex-col">
                      <span class="font-medium">
                        {{ getRecordCount(domain) }} records
                      </span>
                      <span class="text-muted-foreground">
                        Created {{ formatCreatedDate(domain.created_at) }}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </NuxtLink>
    </div>
  </div>
</template>
