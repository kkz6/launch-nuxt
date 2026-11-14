<script setup lang="ts">
import { Toaster } from "~/components/ui/sonner";
import { useImpersonation } from "~/composables/useImpersonation";
import AdminNavigation from "~/components/admin/Navigation.vue";
import WorkspaceLoading from "~/components/layout/WorkspaceLoading.vue";

defineProps<{
  title?: string;
}>();

const { user, isAuthenticated, isInitialized } = useAuth();
const { isImpersonating, impersonatedName, stop } = useImpersonation();
const { t } = useI18n();
const colorMode = useColorMode();
const route = useRoute();
const isAdminRoute = computed(
  () => route.path === "/admin" || route.path.startsWith("/admin/"),
);

const isExiting = ref(false);

const exitImpersonation = async () => {
  if (isExiting.value) return;
  isExiting.value = true;
  try {
    await stop();
  } finally {
    isExiting.value = false;
  }
};

// `isMounted` makes hydration deterministic: SSR + the first client render
// both see `false`, so the template path matches. After mount we re-render
// once with the real auth state. Previously we used <ClientOnly>, which
// emits a fragment / comment placeholder that broke the Nuxt layout
// <Transition> (it needs a single element root).
const isMounted = ref(false);

onMounted(() => {
  isMounted.value = true;

  if (colorMode.preference === "dark") {
    document.documentElement.classList.add("dark");
  } else if (colorMode.preference === "light") {
    document.documentElement.classList.remove("dark");
  }
});

// Show the authed shell only after we're mounted and auth has resolved.
const showAuthedShell = computed(
  () => isMounted.value && isInitialized.value && isAuthenticated.value,
);
const showPlatformUpdates = computed(
  () =>
    showAuthedShell.value &&
    !!user.value?.current_team_id &&
    user.value.current_team?.is_subscribed !== false,
);
</script>

<template>
  <div class="contents">
    <div
      id="app-container"
      class="relative flex h-screen w-full flex-col overflow-hidden bg-background font-sans"
    >
      <a
        href="#workspace-content"
        class="sr-only z-50 rounded-md bg-background px-4 py-2 text-sm shadow focus:not-sr-only focus:absolute focus:left-4 focus:top-2"
        >{{ t("adminShell.skipToContent") }}</a
      >
      <div
        v-if="showAuthedShell && isImpersonating"
        class="flex shrink-0 items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black"
      >
        <span class="flex items-center gap-2">
          <Icon name="lucide:eye" class="h-4 w-4" />
          {{ t("common.impersonation.viewingAs", { name: impersonatedName }) }}
        </span>
        <button
          type="button"
          :disabled="isExiting"
          class="inline-flex items-center gap-1.5 rounded-md bg-black/85 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-black disabled:opacity-60"
          @click="exitImpersonation"
        >
          <Icon
            v-if="isExiting"
            name="lucide:loader-2"
            class="h-3.5 w-3.5 animate-spin"
          />
          <Icon v-else name="lucide:log-out" class="h-3.5 w-3.5" />
          {{ t("common.impersonation.exit") }}
        </button>
      </div>
      <LayoutPlatformUpdateBanner v-if="showPlatformUpdates" />
      <LayoutNavbar v-if="showAuthedShell" />
      <header v-else class="shrink-0 border-b px-4 lg:px-8">
        <div class="flex h-16 items-center">
          <span class="text-xl font-bold">launchctl</span>
        </div>
        <AdminNavigation v-if="isAdminRoute" />
      </header>
      <main
        id="workspace-content"
        tabindex="-1"
        class="min-h-0 w-full flex-1 overflow-y-auto px-4 pt-4 pb-10 lg:px-8"
      >
        <slot v-if="showAuthedShell" />
        <WorkspaceLoading v-else />
      </main>
      <Toaster position="bottom-center" :close-button="true" :duration="4000" />
    </div>
  </div>
</template>
