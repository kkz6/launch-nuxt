<script setup lang="ts">
import { Globe } from "lucide-vue-next";
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";

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

const router = useRouter();
const domains = ref<Domain[]>([]);
const providers = ref<DnsProvider[]>([]);
const isLoading = ref(true);
const activeTab = ref("domains");

const tabs = [
  { value: "servers", label: "Servers", route: "/servers" },
  { value: "domains", label: "Domains", route: "/dns" },
];

const handleTabChange = (value: string | number) => {
  const tab = tabs.find((t) => t.value === String(value));
  if (tab && tab.route !== "/dns") {
    router.push(tab.route);
  }
};

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

onMounted(fetchDomains);
</script>

<template>
  <div class="gap-12">
    <header
      class="mb-6 flex w-full flex-wrap items-center justify-between gap-2"
    >
      <div class="flex flex-col gap-2">
        <h1 class="text-xl font-bold lg:text-3xl">Domains</h1>
        <p class="text-muted-foreground lg:text-medium">
          Manage your domains and DNS settings
        </p>
      </div>
      <DnsAddDomain :providers="providers" @created="fetchDomains">
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Add Domain
        </Button>
      </DnsAddDomain>
    </header>

    <div class="flex w-full justify-between gap-8">
      <Tabs
        v-model="activeTab"
        class="w-full"
        @update:model-value="handleTabChange"
      >
        <div class="border-b border-border">
          <TabsList class="h-auto gap-0 bg-transparent p-0">
            <TabsTrigger
              v-for="tab in tabs"
              :key="tab.value"
              :value="tab.value"
              class="relative -mb-px rounded-none border-b border-transparent px-4 pb-3 pt-2 text-muted-foreground hover:text-foreground data-[state=active]:border-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
            >
              {{ tab.label }}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="domains" class="w-full">
          <div v-if="isLoading" class="flex items-center justify-center py-12">
            <Icon
              name="lucide:loader-2"
              class="h-8 w-8 animate-spin text-muted-foreground"
            />
          </div>

          <div
            v-else-if="domains.length === 0"
            class="mt-6 flex h-[50vh] w-full flex-col items-center justify-center space-y-4"
          >
            <Globe class="size-10 text-muted-foreground md:size-28" />
            <span>No domains configured yet. Click on Add Domain.</span>
          </div>

          <div
            v-else
            class="mt-6 grid w-full gap-5 pb-10 sm:grid-cols-2 lg:grid-cols-3"
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
                        {{ domain.provider?.provider_label || "Provider" }}
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
        </TabsContent>
      </Tabs>
    </div>
  </div>
</template>
