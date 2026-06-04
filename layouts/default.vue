<script setup lang="ts">
import { Toaster } from "~/components/ui/sonner";
import { useImpersonation } from "~/composables/useImpersonation";

defineProps<{
  title?: string;
}>();

const { isAuthenticated, isInitialized } = useAuth();
const { isImpersonating, impersonatedName, stop } = useImpersonation();
const colorMode = useColorMode();

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
</script>

<template>
  <!-- Single-root template: the conditional content lives *inside* one
       wrapper element so Nuxt's layout <Transition> always has a single
       node to animate. The wrapper has no visual styling — it inherits
       block layout from the page tree. -->
  <div class="contents">
    <div
      v-if="showAuthedShell"
      id="app-container"
      class="relative flex h-screen w-full flex-col overflow-hidden bg-background"
    >
      <div
        v-if="isImpersonating"
        class="flex shrink-0 items-center justify-center gap-3 bg-amber-500 px-4 py-2 text-sm font-medium text-black"
      >
        <span class="flex items-center gap-2">
          <Icon name="lucide:eye" class="h-4 w-4" />
          Viewing as <strong>{{ impersonatedName }}</strong> (read-only)
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
          Exit
        </button>
      </div>
      <LayoutPlatformUpdateBanner />
      <LayoutNavbar />
      <main class="w-full flex-1 overflow-y-auto px-4 pt-4 pb-10 lg:px-8">
        <slot />
      </main>
      <Toaster position="bottom-center" :close-button="true" :duration="4000" />
    </div>
    <slot v-else />
  </div>
</template>
