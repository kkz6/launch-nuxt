<script setup lang="ts">
import { toast } from "vue-sonner";
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import type { Server, Site } from "~/types";

interface Props {
  sites: Site[];
  server: Server;
  isLoading?: boolean;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();
const dateFnsLocale = computed(() => (locale.value === "ja" ? ja : enUS));
const emit = defineEmits<{
  deleted: [];
}>();

const isDeleting = ref<string | null>(null);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const deleteSite = async (site: Site) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.sites.deleteTitle"),
    description: t("server.sites.deleteDescription", { address: site.address }),
    confirmText: t("server.common.delete"),
    cancelText: t("server.common.cancel"),
    destructive: true,
  });

  if (!result.ok) return;

  isDeleting.value = site.id;
  try {
    await $api(`/servers/${props.server.id}/sites/${site.id}`, {
      method: "DELETE",
    });
    // Immediately update the local site to show "Uninstalling" status
    site.uninstallation_requested_at = new Date().toISOString();
    site.uninstallation_failed_at = null;
    toast.success(t("server.sites.deleteStarted"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.sites.deleteFailed"));
  } finally {
    isDeleting.value = null;
  }
};

const getSiteTypeIcon = (type: string): string => {
  const normalizedType = type?.toLowerCase() || "";
  if (normalizedType.includes("laravel")) return "simple-icons:laravel";
  if (normalizedType.includes("wordpress")) return "simple-icons:wordpress";
  if (normalizedType.includes("nuxt")) return "simple-icons:nuxtdotjs";
  if (normalizedType.includes("next")) return "simple-icons:nextdotjs";
  if (normalizedType.includes("node")) return "simple-icons:nodedotjs";
  if (normalizedType.includes("python") || normalizedType.includes("django"))
    return "simple-icons:python";
  if (normalizedType.includes("ruby") || normalizedType.includes("rails"))
    return "simple-icons:ruby";
  return "simple-icons:php";
};

const getSiteTypeLabel = (type: string): string => {
  const types: Record<string, string> = {
    laravel: "Laravel",
    wordpress: "WordPress",
    generic: t("server.sites.genericPhp"),
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

const getSiteTypeColor = (type: string): string => {
  const t = type?.toLowerCase() || "";
  if (t.includes("laravel")) return "#FF2D20";
  if (t.includes("wordpress")) return "#21759B";
  if (t.includes("nuxt")) return "#00DC82";
  if (t.includes("next")) return "#171717";
  if (t.includes("node")) return "#5FA04E";
  if (t.includes("python") || t.includes("django")) return "#3776AB";
  if (t.includes("ruby") || t.includes("rails")) return "#CC342D";
  return "#777BB4";
};

const getStatusColor = (site: Site): string => {
  if (site.uninstallation_requested_at && !site.uninstallation_failed_at) {
    return "bg-yellow-500";
  }
  if (site.uninstallation_failed_at || site.installation_failed_at) {
    return "bg-red-500";
  }
  if (!site.installed_at) {
    return "bg-yellow-500";
  }
  return "bg-green-500";
};

const getStatusLabel = (site: Site): { text: string; loading: boolean } => {
  if (site.uninstallation_requested_at && !site.uninstallation_failed_at) {
    return { text: t("server.sites.uninstalling"), loading: true };
  }
  if (site.uninstallation_failed_at) {
    return { text: t("server.sites.uninstallationFailed"), loading: false };
  }
  if (site.installation_failed_at) {
    return { text: t("server.sites.installationFailed"), loading: false };
  }
  if (site.installed_at) {
    return { text: t("server.sites.installed"), loading: false };
  }
  return { text: t("server.sites.installing"), loading: true };
};

const isAccessible = (site: Site) => {
  return Boolean(site.installed_at) && !site.uninstallation_requested_at;
};

// Cache site data for Navbar when navigating to detail page
const { cacheSite } = useNavbarCache();

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), {
      addSuffix: true,
      locale: dateFnsLocale.value,
    });
  } catch {
    return "";
  }
};
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="sites?.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:globe" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">{{ t("server.sites.empty") }}</p>
        <p class="text-sm text-muted-foreground">
          {{ t("server.sites.emptyDescription") }}
        </p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="site in sites"
        :key="site.id"
        :to="
          isAccessible(site) ? `/servers/${server.id}/sites/${site.id}` : '#'
        "
        class="group"
        :class="{ 'pointer-events-none': !isAccessible(site) }"
        @click="cacheSite(site)"
      >
        <div
          class="relative rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
          :class="{
            'opacity-60': !isAccessible(site),
          }"
        >
          <!-- Delete button for failed or uninstalling sites -->
          <button
            v-if="
              (site.installation_failed_at || site.uninstallation_failed_at) &&
              !site.uninstallation_requested_at
            "
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
            <div
              class="brand-icon-bg flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted transition-colors duration-200"
              :style="{ '--brand-color': getSiteTypeColor(site.type) }"
            >
              <Icon
                :name="getSiteTypeIcon(site.type)"
                class="brand-icon h-5 w-5 text-muted-foreground transition-colors duration-200"
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
                  site.installation_failed_at || site.uninstallation_failed_at
                    ? 'text-destructive'
                    : '',
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

<style scoped>
.group:hover .brand-icon-bg {
  background-color: var(--brand-color);
}

.group:hover .brand-icon {
  color: white;
}
</style>
