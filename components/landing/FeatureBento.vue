<script setup lang="ts">
// Features — calm, spacious. Six headline capabilities, no categories,
// no chips, no logos. The long tail collapses into a single line so the
// breadth is acknowledged without crowding the page. Keeps the emerald
// accent and mono titles so it stays on-brand with the rest of the page.

const { t } = useI18n();

const features = computed(() => [
  {
    icon: "lucide:server",
    title: t("public.featureBento.features.appServers.title"),
    desc: t("public.featureBento.features.appServers.description"),
  },
  {
    icon: "lucide:box",
    title: t("public.featureBento.features.docker.title"),
    desc: t("public.featureBento.features.docker.description"),
  },
  {
    icon: "lucide:activity",
    title: t("public.featureBento.features.queues.title"),
    desc: t("public.featureBento.features.queues.description"),
  },
  {
    icon: "lucide:square-terminal",
    title: t("public.featureBento.features.logs.title"),
    desc: t("public.featureBento.features.logs.description"),
  },
  {
    icon: "lucide:rocket",
    title: t("public.featureBento.features.cicd.title"),
    desc: t("public.featureBento.features.cicd.description"),
  },
  {
    icon: "lucide:shield-check",
    title: t("public.featureBento.features.operations.title"),
    desc: t("public.featureBento.features.operations.description"),
  },
]);

const alsoIncluded = computed(() => t("public.featureBento.alsoIncluded"));
</script>

<template>
  <section class="border-b">
    <div class="mx-auto max-w-6xl px-6 py-28 lg:px-8">
      <!-- header -->
      <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
          >$ lctl --help</span
        >
        <h2
          class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
        >
          <RevealText :text="t('public.featureBento.heading')" />
        </h2>
        <p class="mt-4 text-pretty text-lg text-muted-foreground">
          {{ t("public.featureBento.description") }}
        </p>
      </div>

      <!-- six roomy cards -->
      <div
        class="mx-auto mt-20 grid max-w-5xl gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3"
      >
        <div
          v-for="(f, i) in features"
          :key="f.title"
          data-aos="fade-up"
          :data-aos-delay="(i % 3) * 80"
        >
          <div
            class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
          >
            <Icon
              :name="f.icon"
              class="h-5 w-5 text-emerald-600 dark:text-emerald-400"
            />
          </div>
          <h3 class="mt-5 font-mono text-base font-semibold">{{ f.title }}</h3>
          <p
            class="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground"
          >
            {{ f.desc }}
          </p>
        </div>
      </div>

      <!-- long tail, one quiet line -->
      <p
        class="mx-auto mt-20 max-w-3xl text-center font-mono text-xs leading-relaxed text-muted-foreground/70"
        data-aos="fade-up"
      >
        <span class="text-muted-foreground"
          ># {{ t("public.featureBento.andMore") }}</span
        >
        — {{ alsoIncluded }}
      </p>
    </div>
  </section>
</template>
