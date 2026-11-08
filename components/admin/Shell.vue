<script setup lang="ts">
import Navigation from "./Navigation.vue";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "~/components/ui/sheet";

const { t } = useI18n();
const route = useRoute();
const breadcrumbState = usePageBreadcrumbState();
const crumbs = computed(() =>
  breadcrumbState.value?.path === route.path
    ? breadcrumbState.value.crumbs
    : [],
);
const mobileOpen = ref(false);
watch(
  () => route.path,
  () => {
    mobileOpen.value = false;
  },
);
</script>

<template>
  <div class="admin-shell relative flex min-h-0 flex-1 text-foreground">
    <a
      href="#admin-content"
      class="sr-only z-50 rounded-md bg-background px-4 py-2 text-sm shadow focus:not-sr-only focus:absolute focus:left-4 focus:top-2"
    >
      {{ t("adminShell.skipToContent") }}
    </a>
    <aside
      class="hidden w-[212px] shrink-0 flex-col border-r border-border/60 bg-muted/40 lg:flex"
    >
      <div class="px-6 pb-7 pt-6">
        <NuxtLink
          to="/admin/overview"
          class="inline-flex items-center text-xl font-bold"
        >
          launchctl
        </NuxtLink>
        <p class="mt-1.5 text-[11px] text-muted-foreground">
          {{ t("adminShell.title") }}
        </p>
      </div>
      <div class="flex-1 overflow-y-auto px-3 pb-6">
        <Navigation />
      </div>
      <div class="p-3 pb-5">
        <NuxtLink
          to="/dashboard"
          class="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Icon name="lucide:arrow-left" class="h-4 w-4" aria-hidden="true" />
          {{ t("common.backToApp") }}
        </NuxtLink>
      </div>
    </aside>

    <div class="flex min-w-0 flex-1 flex-col bg-background">
      <div
        class="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-4 sm:px-6 lg:px-8"
      >
        <Sheet v-model:open="mobileOpen">
          <SheetTrigger as-child>
            <Button
              variant="ghost"
              size="icon"
              class="-ml-2 lg:hidden"
              :aria-label="t('adminShell.openNavigation')"
            >
              <Icon name="lucide:menu" class="h-5 w-5" aria-hidden="true" />
            </Button>
          </SheetTrigger>
          <SheetContent
            side="left"
            :close-label="t('common.ui.close')"
            class="admin-shell flex w-64 flex-col bg-background p-4"
          >
            <SheetHeader class="mb-6 text-left">
              <SheetTitle>{{ t("adminShell.title") }}</SheetTitle>
              <SheetDescription>{{
                t("adminShell.navigationDescription")
              }}</SheetDescription>
            </SheetHeader>
            <Navigation @navigate="mobileOpen = false" />
            <NuxtLink
              to="/dashboard"
              class="mt-auto flex items-center gap-2 rounded-lg px-3 py-3 text-sm font-medium"
              @click="mobileOpen = false"
            >
              <Icon
                name="lucide:arrow-left"
                class="h-4 w-4"
                aria-hidden="true"
              />
              {{ t("common.backToApp") }}
            </NuxtLink>
          </SheetContent>
        </Sheet>
        <nav :aria-label="t('adminShell.breadcrumb')" class="min-w-0">
          <ol
            v-if="crumbs.length"
            class="flex min-w-0 items-center gap-2 text-xs"
          >
            <li
              v-for="(crumb, index) in crumbs"
              :key="index"
              class="flex min-w-0 items-center gap-2"
            >
              <Icon
                v-if="index"
                name="lucide:chevron-right"
                class="h-3.5 w-3.5 shrink-0 text-muted-foreground/60"
                aria-hidden="true"
              />
              <NuxtLink
                v-if="crumb.to && index < crumbs.length - 1"
                :to="crumb.to"
                class="truncate text-muted-foreground hover:text-foreground"
                :title="crumb.label"
                >{{ crumb.label }}</NuxtLink
              >
              <span
                v-else
                class="truncate font-medium"
                :aria-current="index === crumbs.length - 1 ? 'page' : undefined"
                :title="crumb.label"
                >{{ crumb.label }}</span
              >
            </li>
          </ol>
          <span v-else class="text-sm font-medium">{{
            t("adminShell.title")
          }}</span>
        </nav>
        <div class="ml-auto flex shrink-0 items-center">
          <slot name="toolbar" />
        </div>
      </div>
      <main
        id="admin-content"
        tabindex="-1"
        class="min-h-0 flex-1 overflow-y-auto"
      >
        <div
          class="mx-auto w-full max-w-[1600px] px-4 pb-10 pt-4 sm:px-6 lg:px-8"
        >
          <slot />
        </div>
      </main>
    </div>
  </div>
</template>
