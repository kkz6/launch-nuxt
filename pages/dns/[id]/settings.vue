<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

interface Domain {
  id: string;
  label: string;
  address: string;
  provider?: {
    provider: string;
    provider_label: string;
  };
}

const route = useRoute();
const domainId = computed(() => route.params.id as string);

const domain = ref<Domain | null>(null);
const isLoading = ref(true);

const fetchDomainData = async () => {
  try {
    const response = await $api<{
      data: {
        domain: Domain;
      };
    }>(`/dns/domains/${domainId.value}`);
    domain.value = response.data.domain;
    useHead({ title: `Settings - ${domain.value?.address || "Domain"}` });
  } catch {
    toast.error("Failed to load domain data");
    navigateTo("/dns");
  } finally {
    isLoading.value = false;
  }
};

const handleDeleted = () => {
  navigateTo("/dns");
};

const handleUpdated = () => {
  fetchDomainData();
};

onMounted(fetchDomainData);
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else-if="domain">
      <div class="flex flex-col gap-4">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <NuxtLink to="/dns">Domains</NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink as-child>
                <NuxtLink :to="`/dns/${domain.id}`">{{
                  domain.address
                }}</NuxtLink>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink>Settings</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>

        <header class="mb-6">
          <h1 class="text-xl font-bold lg:text-3xl">Domain Settings</h1>
          <p class="mt-1 text-muted-foreground">
            Manage settings for {{ domain.address }}
          </p>
        </header>
      </div>

      <DnsDomainSettings
        :domain="domain"
        @deleted="handleDeleted"
        @updated="handleUpdated"
      />
    </template>
  </div>
</template>
