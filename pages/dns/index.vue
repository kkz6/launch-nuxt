<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({ title: "Domains" });

interface DomainProvider {
  id: string;
  profile: string;
  provider: string;
}

interface DnsProvider {
  id: string;
  profile: string;
  provider: string;
  provider_label: string;
  connected: boolean;
  sync_status: string;
  last_synced_at: string;
  domains_count: number;
}

interface Domain {
  id: string;
  label: string;
  address: string;
  provider_id: string;
  domain_provider_id: string;
  provider?: DomainProvider;
  records_count: number;
  created_at: string;
  updated_at: string;
}

interface DomainsResponse {
  success: boolean;
  message: string;
  data: {
    domains: Domain[];
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
    domains.value = response.data.domains;
    providers.value = response.data.providers;
  } catch {
    toast.error("Failed to load domains");
  } finally {
    isLoading.value = false;
  }
};

const formatCreatedDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

const getProviderInfo = (domain: Domain): { label: string; profile: string } => {
  // First try to get from providers list using domain_provider_id
  const provider = providers.value.find(p => p.id === domain.domain_provider_id);
  if (provider) {
    return {
      label: provider.provider_label,
      profile: provider.profile
    };
  }

  // Fallback to domain's embedded provider
  if (domain.provider) {
    return {
      label: domain.provider.provider,
      profile: domain.provider.profile
    };
  }

  return { label: "Unknown", profile: "" };
};

const getProviderIcon = (providerName: string): string => {
  const name = providerName.toLowerCase();
  if (name.includes('cloudflare')) return 'simple-icons:cloudflare';
  if (name.includes('route53') || name.includes('aws')) return 'simple-icons:amazonwebservices';
  if (name.includes('digitalocean')) return 'simple-icons:digitalocean';
  if (name.includes('godaddy')) return 'simple-icons:godaddy';
  return 'lucide:globe';
};

onMounted(fetchDomains);
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="domains.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:globe" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">No domains configured yet</p>
        <p class="text-sm text-muted-foreground">Click on Add Domain to get started</p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="domain in domains"
        :key="domain.id"
        :to="`/dns/${domain.id}`"
        class="group"
      >
        <div class="rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50">
          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon
                :name="getProviderIcon(getProviderInfo(domain).label)"
                class="h-5 w-5 text-muted-foreground"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">{{ domain.address }}</h3>
              </div>
              <p class="text-sm text-muted-foreground truncate">
                {{ getProviderInfo(domain).profile }}
              </p>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between text-sm">
            <div class="flex items-center gap-4">
              <div class="flex items-center gap-1.5 text-muted-foreground">
                <Icon name="lucide:file-text" class="h-3.5 w-3.5" />
                <span>{{ domain.records_count }} records</span>
              </div>
            </div>
            <span class="text-muted-foreground">
              {{ formatCreatedDate(domain.created_at) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
