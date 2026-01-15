<script setup lang="ts">
import { toast } from "vue-sonner";

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
      <DnsDomainSettings
        :domain="domain"
        @deleted="handleDeleted"
        @updated="handleUpdated"
      />
    </template>
  </div>
</template>
