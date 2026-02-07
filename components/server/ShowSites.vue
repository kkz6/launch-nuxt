<script setup lang="ts">
import { toast } from "vue-sonner";
import { formatDistanceToNow } from "date-fns";
import type { Server, Site } from "~/types";

interface Props {
  sites: Site[];
  server: Server;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  deleted: []
}>();

const isDeleting = ref<string | null>(null);
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null);

const deleteSite = async (site: Site) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: 'Delete Site',
    description: `Are you sure you want to delete "${site.address}"? This action cannot be undone.`,
    confirmText: 'Delete',
    cancelText: 'Cancel',
    destructive: true,
  });

  if (!result.ok) return;

  isDeleting.value = site.id;
  try {
    await $api(`/servers/${props.server.id}/sites/${site.id}`, {
      method: 'DELETE',
    });
    toast.success('Site deleted successfully');
    emit('deleted');
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || 'Failed to delete site');
  } finally {
    isDeleting.value = null;
  }
};

const getSiteTypeIcon = (type: string): string => {
  const t = type?.toLowerCase() || "";
  if (t.includes("laravel")) return "simple-icons:laravel";
  if (t.includes("wordpress")) return "simple-icons:wordpress";
  if (t.includes("nuxt")) return "simple-icons:nuxtdotjs";
  if (t.includes("next")) return "simple-icons:nextdotjs";
  if (t.includes("node")) return "simple-icons:nodedotjs";
  if (t.includes("python") || t.includes("django")) return "simple-icons:python";
  if (t.includes("ruby") || t.includes("rails")) return "simple-icons:ruby";
  return "simple-icons:php";
};

const getSiteTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    laravel: "Laravel",
    wordpress: "WordPress",
    generic: "Generic PHP",
    nuxt: "Nuxt",
    nextjs: "Next.js",
    nodejs: "Node.js",
    python: "Python",
    django: "Django",
    ruby: "Ruby",
    rails: "Ruby on Rails",
  };
  return types[type] || type;
};

const getStatusColor = (site: Site): string => {
  if (site.installation_failed_at || site.uninstallation_failed_at) {
    return "bg-red-500";
  }
  if (site.uninstallation_requested_at || !site.installed_at) {
    return "bg-yellow-500";
  }
  return "bg-green-500";
};

const getStatusLabel = (site: Site): { text: string; loading: boolean } => {
  if (site.installation_failed_at) {
    return { text: "Installation failed", loading: false };
  }
  if (site.uninstallation_failed_at) {
    return { text: "Uninstallation failed", loading: false };
  }
  if (site.uninstallation_requested_at) {
    return { text: "Uninstalling", loading: true };
  }
  if (site.installed_at) {
    return { text: "Installed", loading: false };
  }
  return { text: "Installing", loading: true };
};

const isAccessible = (site: Site) => {
  return Boolean(site.installed_at) && !site.uninstallation_requested_at;
};

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      v-if="sites?.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:globe" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">No sites found</p>
        <p class="text-sm text-muted-foreground">Click on Add Site to get started</p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="site in sites"
        :key="site.id"
        :to="isAccessible(site) ? `/servers/${server.id}/sites/${site.id}` : '#'"
        class="group"
        :class="{ 'pointer-events-none': !isAccessible(site) }"
      >
        <div
          class="relative rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          :class="{
            'opacity-60': !isAccessible(site),
          }"
        >
          <!-- Delete button for failed installations -->
          <button
            v-if="site.installation_failed_at"
            type="button"
            class="pointer-events-auto absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            :disabled="isDeleting === site.id"
            @click.prevent.stop="deleteSite(site)"
          >
            <Icon
              v-if="isDeleting === site.id"
              name="lucide:loader-2"
              class="h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:trash-2" class="h-4 w-4" />
          </button>

          <div class="flex items-start gap-3">
            <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
              <Icon
                :name="getSiteTypeIcon(site.type)"
                class="h-5 w-5 text-muted-foreground"
              />
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2">
                <h3 class="font-semibold truncate">{{ site.address }}</h3>
                <span
                  class="h-2 w-2 shrink-0 rounded-full"
                  :class="getStatusColor(site)"
                />
              </div>
              <div class="flex items-center gap-1.5">
                <p class="text-sm text-muted-foreground truncate">
                  {{ getSiteTypeLabel(site.type) }}
                </p>
                <span
                  v-if="site.load_balanced_upstream_id"
                  class="inline-flex shrink-0 items-center rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-medium text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400"
                >
                  LB
                </span>
              </div>
            </div>
          </div>

          <div class="mt-4 flex items-center justify-between text-sm">
            <div class="flex items-center gap-1.5">
              <Icon
                v-if="getStatusLabel(site).loading"
                name="lucide:loader-2"
                class="h-3.5 w-3.5 animate-spin text-muted-foreground"
              />
              <span
                :class="[
                  getStatusLabel(site).loading ? 'text-muted-foreground' : '',
                  site.installation_failed_at || site.uninstallation_failed_at ? 'text-destructive' : ''
                ]"
              >
                {{ getStatusLabel(site).text }}
              </span>
            </div>
            <span class="text-muted-foreground">
              {{ formatDate(site.installed_at || site.created_at) }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
