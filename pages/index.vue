<script setup lang="ts">
// Landing page — terminal / developer-native rebuild.
//
// Aesthetic: monospace headings + labels, a command-palette / console
// motif, a blueprint grid, and dark terminal windows as the hero and
// section centrepieces. Built on the shadcn design tokens so light AND
// dark both work; the terminal windows are intentionally always-dark
// (like a real terminal) for a consistent, crafted-for-engineers feel.
//
// The command motif uses the real CLI name, `lctl`.
definePageMeta({ layout: "site" });
const { t } = useI18n();

// Note: nuxt.config sets titleTemplate "%s - launchctl", so the title
// here must NOT repeat the brand or it doubles up.
useHead({ title: () => t("public.home.pageTitle") });
useSeoMeta({
  description: () => t("public.home.metaDescription"),
  ogTitle: () => t("public.home.metaTitle"),
  ogDescription: () => t("public.home.socialDescription"),
  ogImage: "/images/og-image.png",
  ogUrl: "https://launchctl.io",
  ogType: "website",
  twitterTitle: () => t("public.home.metaTitle"),
  twitterDescription: () => t("public.home.socialDescription"),
  twitterImage: "/images/og-image.png",
  twitterCard: "summary_large_image",
});

const { isAuthenticated } = useAuth();
const ctaTo = computed(() =>
  isAuthenticated.value ? "/servers" : "/register",
);

const clouds = ["DigitalOcean", "Hetzner", "AWS", "Linode", "Vultr"];

// Hero product mockup — a real "Deployments" panel, not a terminal.
const heroDeploys = computed(() => [
  {
    status: t("public.home.preview.live"),
    tone: "emerald",
    sha: "9f2c1ab",
    branch: "main",
    who: "GitHub Actions",
    when: t("public.home.preview.justNow"),
    dur: t("public.home.preview.durationMinute", { minutes: 1, seconds: 12 }),
  },
  {
    status: t("public.home.preview.live"),
    tone: "emerald",
    sha: "a7e44d0",
    branch: "main",
    who: "Priya Nair",
    when: t("public.home.preview.hoursAgo", { count: 2 }),
    dur: t("public.home.preview.durationSeconds", { seconds: 58 }),
  },
  {
    status: t("public.home.preview.building"),
    tone: "amber",
    sha: "c01f9b2",
    branch: "feat/checkout",
    who: "GitHub Actions",
    when: t("public.home.preview.running"),
    dur: t("public.home.preview.durationSeconds", { seconds: 34 }),
  },
  {
    status: t("public.home.preview.live"),
    tone: "emerald",
    sha: "4db8e1f",
    branch: "main",
    who: "Marco Bianchi",
    when: t("public.home.preview.yesterday"),
    dur: t("public.home.preview.durationMinute", { minutes: 1, seconds: 4 }),
  },
]);
const heroMetrics = computed(() => [
  { label: t("public.home.preview.cpu"), value: "18%" },
  { label: t("public.home.preview.memory"), value: "512 MB" },
  { label: t("public.home.preview.uptime"), value: "99.98%" },
]);

const stack = [
  { src: "/images/services/docker.svg", label: "docker" },
  { src: "/images/services/postgresql.svg", label: "postgres" },
  { src: "/images/services/mysql.svg", label: "mysql" },
  { src: "/images/services/memory_database.svg", label: "redis" },
  { src: "/images/services/node.svg", label: "node" },
  { src: "/images/services/php.svg", label: "php" },
  { src: "/images/services/bun.svg", label: "bun" },
  { src: "/images/services/traefik.svg", label: "traefik" },
];

// GitHub Actions CI run — the second terminal.
const ciRun = [
  {
    mark: "✓",
    mcls: "text-emerald-400",
    k: "trigger",
    v: "launch-deploy.yml",
    tail: "",
    tcls: "",
  },
  {
    mark: "▸",
    mcls: "text-zinc-500",
    k: "build",
    v: "docker buildx",
    tail: "42s",
    tcls: "text-zinc-500",
  },
  {
    mark: "▸",
    mcls: "text-zinc-500",
    k: "push",
    v: "ghcr.io · private",
    tail: "ok",
    tcls: "text-emerald-400",
  },
  {
    mark: "▸",
    mcls: "text-zinc-500",
    k: "notify",
    v: "launchctl webhook",
    tail: "200",
    tcls: "text-cyan-400",
  },
  {
    mark: "▸",
    mcls: "text-zinc-500",
    k: "pull",
    v: "short-lived token",
    tail: "ok",
    tcls: "text-emerald-400",
  },
];

// Feature breadth now lives in components/landing/FeatureBento.vue.
const ciPoints = computed(() => [
  t("public.home.cicd.points.shortLivedTokens"),
  t("public.home.cicd.points.offProduction"),
  t("public.home.cicd.points.explicitDeploys"),
]);

const steps = computed(() => [
  {
    no: "01",
    cmd: "server:provision",
    title: t("public.home.steps.provision.title"),
    desc: t("public.home.steps.provision.description"),
  },
  {
    no: "02",
    cmd: "app:configure",
    title: t("public.home.steps.configure.title"),
    desc: t("public.home.steps.configure.description"),
  },
  {
    no: "03",
    cmd: "deploy",
    title: t("public.home.steps.ship.title"),
    desc: t("public.home.steps.ship.description"),
  },
]);

const controlChips = computed(() => [
  t("public.home.observe.chips.liveLogs"),
  t("public.home.observe.chips.webTerminal"),
  t("public.home.observe.chips.queueLogs"),
  t("public.home.observe.chips.backups"),
  t("public.home.observe.chips.rollback"),
  t("public.home.observe.chips.metrics"),
]);

const logLines = [
  {
    t: "12:45:14",
    lvl: "INF",
    cls: "text-emerald-400",
    msg: "starting api server…",
  },
  {
    t: "12:45:14",
    lvl: "DBG",
    cls: "text-cyan-400",
    msg: "connected to postgres",
  },
  {
    t: "12:45:15",
    lvl: "INF",
    cls: "text-emerald-400",
    msg: "listening on :8080",
  },
  {
    t: "12:45:21",
    lvl: "WRN",
    cls: "text-amber-400",
    msg: "queue worker restarted",
  },
  {
    t: "12:45:49",
    lvl: "INF",
    cls: "text-emerald-400",
    msg: "deploy succeeded · health ok",
  },
];

const faqs = computed(() => [
  {
    q: t("public.home.faq.items.location.question"),
    a: t("public.home.faq.items.location.answer"),
  },
  {
    q: t("public.home.faq.items.php.question"),
    a: t("public.home.faq.items.php.answer"),
  },
  {
    q: t("public.home.faq.items.queues.question"),
    a: t("public.home.faq.items.queues.answer"),
  },
  {
    q: t("public.home.faq.items.tokens.question"),
    a: t("public.home.faq.items.tokens.answer"),
  },
  {
    q: t("public.home.faq.items.workflow.question"),
    a: t("public.home.faq.items.workflow.answer"),
  },
  {
    q: t("public.home.faq.items.databases.question"),
    a: t("public.home.faq.items.databases.answer"),
  },
]);
</script>

<template>
  <div class="bg-background text-foreground">
    <!-- ───────────────────────── Hero ───────────────────────── -->
    <section class="relative overflow-hidden border-b">
      <!-- soft ambient wash + faint grid, lighter than the dark rebuild -->
      <div
        class="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_55%_at_78%_-5%,theme(colors.emerald.500/9%),transparent)]"
      />
      <div
        class="bp-grid pointer-events-none absolute inset-0 opacity-[0.55] [mask-image:radial-gradient(ellipse_70%_55%_at_50%_-10%,black,transparent)]"
      />

      <div
        class="relative mx-auto grid max-w-6xl items-center gap-y-14 px-6 pb-24 pt-20 lg:grid-cols-12 lg:gap-x-10 lg:px-8 lg:pb-28 lg:pt-28"
      >
        <!-- copy -->
        <div class="lg:col-span-5" data-aos="fade-up">
          <div
            class="inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground shadow-sm"
          >
            <span class="relative flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75"
              />
              <span
                class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500"
              />
            </span>
            {{ t("public.home.hero.eyebrow") }}
          </div>

          <h1
            class="mt-6 text-balance text-5xl font-semibold leading-[1.04] tracking-tight sm:text-6xl"
          >
            <RevealText
              :text="t('public.home.hero.heading')"
              :delay="0.1"
              :stagger="0.07"
            />
          </h1>
          <p
            class="mt-6 max-w-md text-pretty text-lg leading-relaxed text-muted-foreground"
          >
            {{ t("public.home.hero.description") }}
          </p>

          <div class="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
            <NuxtLink
              :to="ctaTo"
              class="group inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition hover:-translate-y-0.5 active:translate-y-0"
            >
              {{ t("public.home.hero.startDeploying") }}
              <Icon
                name="lucide:arrow-right"
                class="h-4 w-4 transition-transform group-hover:translate-x-0.5"
              />
            </NuxtLink>
            <NuxtLink
              to="/docs"
              class="inline-flex items-center gap-1.5 px-2 py-3 text-sm font-semibold text-foreground transition-colors hover:text-emerald-600 dark:hover:text-emerald-400"
            >
              {{ t("public.home.readDocs") }}
              <Icon name="lucide:arrow-up-right" class="h-4 w-4" />
            </NuxtLink>
          </div>

          <div
            class="mt-10 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground"
          >
            <span class="uppercase tracking-wide text-muted-foreground/60">{{
              t("public.home.runsOn")
            }}</span>
            <span
              v-for="c in clouds"
              :key="c"
              class="font-medium text-foreground/65"
              >{{ c }}</span
            >
          </div>
        </div>

        <!-- product mockup: a real Deployments panel -->
        <div
          class="lg:col-span-7 lg:pl-6"
          data-aos="fade-up"
          data-aos-delay="120"
        >
          <div class="relative">
            <!-- depth: a faint card peeking behind -->
            <div
              class="absolute -right-3 -top-3 hidden h-full w-full rounded-2xl border bg-card/60 sm:block"
              aria-hidden="true"
            />

            <div
              class="relative overflow-hidden rounded-2xl border bg-card shadow-xl shadow-emerald-950/[0.06] ring-1 ring-black/[0.02]"
            >
              <!-- panel header -->
              <div class="flex items-center gap-3 border-b px-5 py-3.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
                >
                  <Icon
                    name="lucide:box"
                    class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                  />
                </div>
                <div class="min-w-0">
                  <div class="truncate text-sm font-semibold">gj-hrms-api</div>
                  <div class="font-mono text-xs text-muted-foreground">
                    hrms.example.com
                  </div>
                </div>
                <span
                  class="ml-auto inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-400"
                >
                  <span class="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  {{ t("public.home.preview.production") }}
                </span>
              </div>

              <!-- deployments list -->
              <div class="divide-y">
                <div
                  v-for="d in heroDeploys"
                  :key="d.sha"
                  class="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-muted/40"
                >
                  <span
                    class="inline-flex w-[68px] shrink-0 items-center gap-1.5 text-xs font-medium"
                    :class="
                      d.tone === 'emerald'
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-amber-600 dark:text-amber-400'
                    "
                  >
                    <span
                      class="h-1.5 w-1.5 rounded-full"
                      :class="[
                        d.tone === 'emerald'
                          ? 'bg-emerald-500'
                          : 'bg-amber-500',
                        d.tone === 'amber' ? 'animate-pulse' : '',
                      ]"
                    />
                    {{ d.status }}
                  </span>
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-2 font-mono text-xs">
                      <span class="font-medium text-foreground">{{
                        d.sha
                      }}</span>
                      <span class="truncate text-muted-foreground">{{
                        d.branch
                      }}</span>
                    </div>
                    <div class="mt-0.5 truncate text-xs text-muted-foreground">
                      {{ d.who }}
                    </div>
                  </div>
                  <div class="shrink-0 text-right">
                    <div class="text-xs tabular-nums text-muted-foreground">
                      {{ d.when }}
                    </div>
                    <div
                      class="font-mono text-[11px] tabular-nums text-muted-foreground/70"
                    >
                      {{ d.dur }}
                    </div>
                  </div>
                </div>
              </div>

              <!-- metrics footer -->
              <div class="grid grid-cols-3 divide-x border-t bg-muted/30">
                <div v-for="m in heroMetrics" :key="m.label" class="px-5 py-3">
                  <div
                    class="text-[11px] uppercase tracking-wide text-muted-foreground/70"
                  >
                    {{ m.label }}
                  </div>
                  <div class="mt-0.5 text-sm font-semibold tabular-nums">
                    {{ m.value }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ──────────────────────── Trust strip ──────────────────────── -->
    <section class="border-b bg-muted/30">
      <div class="mx-auto max-w-6xl px-6 py-10 lg:px-8">
        <p class="text-center font-mono text-xs text-muted-foreground">
          # {{ t("public.home.runsOnYourCloud") }} — {{ clouds.join(" · ") }}
        </p>
        <div
          class="mt-7 flex flex-wrap items-center justify-center gap-x-9 gap-y-5"
        >
          <div
            v-for="technology in stack"
            :key="technology.label"
            class="flex items-center gap-2 opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
          >
            <img :src="technology.src" :alt="technology.label" class="h-6 w-6">
            <span class="font-mono text-sm text-muted-foreground">{{
              technology.label
            }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ──────────────────── GitHub Actions CI/CD ──────────────────── -->
    <section class="border-b">
      <div
        class="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:px-8"
      >
        <div data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
            ># ci/cd</span
          >
          <h2
            class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
          >
            <RevealText :text="t('public.home.cicd.heading')" />
          </h2>
          <p class="mt-5 text-lg leading-relaxed text-muted-foreground">
            {{ t("public.home.cicd.descriptionBefore") }}
            <span class="font-mono text-sm font-medium text-foreground"
              >github_actions</span
            >
            {{ t("public.home.cicd.descriptionAfter") }}
          </p>
          <ul class="mt-7 space-y-3">
            <li v-for="point in ciPoints" :key="point" class="flex items-start gap-3">
              <Icon
                name="lucide:check"
                class="mt-1 h-4 w-4 shrink-0 text-emerald-500"
              />
              <span class="text-sm text-muted-foreground">{{ point }}</span>
            </li>
          </ul>
        </div>

        <!-- CI run terminal -->
        <div data-aos="fade-up" data-aos-delay="120">
          <div
            class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/20"
          >
            <div
              class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5"
            >
              <span class="h-3 w-3 rounded-full bg-rose-400/80" />
              <span class="h-3 w-3 rounded-full bg-amber-400/80" />
              <span class="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span class="ml-3 font-mono text-xs text-zinc-500"
                >actions — launch-deploy.yml</span
              >
            </div>
            <div class="space-y-2 p-5 font-mono text-sm sm:p-6">
              <div class="text-zinc-100">
                <span class="text-emerald-400">$</span> git push origin main
              </div>
              <div
                v-for="s in ciRun"
                :key="s.k"
                class="flex items-center gap-3"
              >
                <span :class="s.mcls">{{ s.mark }}</span>
                <span class="w-16 shrink-0 text-zinc-400">{{ s.k }}</span>
                <span class="flex-1 truncate text-zinc-300">{{ s.v }}</span>
                <span v-if="s.tail" :class="s.tcls">{{ s.tail }}</span>
              </div>
              <div class="flex items-center gap-3 pt-1">
                <span class="text-emerald-400">✓</span>
                <span class="text-emerald-400">{{
                  t("public.home.cicd.appLive", { app: "gj-hrms-api" })
                }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────────────── Features bento (full breadth) ───────────────── -->
    <LandingFeatureBento />

    <!-- ──────────────────────── How it works ──────────────────────── -->
    <section class="border-b">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
            ># {{ t("public.home.steps.eyebrow") }}</span
          >
          <h2
            class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
          >
            <RevealText :text="t('public.home.steps.heading')" />
          </h2>
        </div>
        <div class="mt-16 grid gap-5 md:grid-cols-3">
          <div
            v-for="(s, i) in steps"
            :key="s.no"
            class="rounded-lg border bg-card p-6 shadow-sm"
            data-aos="fade-up"
            :data-aos-delay="i * 100"
          >
            <div class="flex items-center justify-between font-mono text-xs">
              <span class="text-emerald-600 dark:text-emerald-400"
                >$ lctl {{ s.cmd }}</span
              >
              <span class="text-muted-foreground/40"># {{ s.no }}</span>
            </div>
            <h3 class="mt-5 font-mono text-lg font-semibold">{{ s.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
              {{ s.desc }}
            </p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─────────────── Deep dive: logs & control ─────────────── -->
    <section class="border-b bg-muted/20">
      <div
        class="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:px-8"
      >
        <div class="order-2 lg:order-1" data-aos="fade-up">
          <div
            class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/20"
          >
            <div
              class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5"
            >
              <span class="h-3 w-3 rounded-full bg-rose-400/80" />
              <span class="h-3 w-3 rounded-full bg-amber-400/80" />
              <span class="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span class="ml-3 font-mono text-xs text-zinc-500"
                >lctl logs — gj-hrms-api -f</span
              >
            </div>
            <div
              class="space-y-1.5 p-5 font-mono text-xs leading-relaxed sm:text-sm"
            >
              <div v-for="l in logLines" :key="l.t + l.msg" class="flex gap-3">
                <span class="shrink-0 tabular-nums text-zinc-600">{{
                  l.t
                }}</span>
                <span class="w-8 shrink-0 font-semibold" :class="l.cls">{{
                  l.lvl
                }}</span>
                <span class="text-zinc-300">{{ l.msg }}</span>
              </div>
              <div class="text-zinc-100">
                <span class="text-emerald-400">$</span>
                <span class="caret">▋</span>
              </div>
            </div>
          </div>
        </div>

        <div class="order-1 lg:order-2" data-aos="fade-up" data-aos-delay="120">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
            ># {{ t("public.home.observe.eyebrow") }}</span
          >
          <h2
            class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
          >
            <RevealText :text="t('public.home.observe.heading')" />
          </h2>
          <p class="mt-5 text-lg leading-relaxed text-muted-foreground">
            {{ t("public.home.observe.description") }}
          </p>
          <div class="mt-7 flex flex-wrap gap-2">
            <span
              v-for="chip in controlChips"
              :key="chip"
              class="rounded-md border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground"
              >{{ chip }}</span
            >
          </div>
        </div>
      </div>
    </section>

    <!-- ───────────────────────────── FAQ ───────────────────────────── -->
    <section class="border-b">
      <div
        class="mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-6 py-24 lg:grid-cols-[0.85fr_1.15fr] lg:px-8"
      >
        <!-- intro -->
        <div data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"
            ># {{ t("public.home.faq.eyebrow") }}</span
          >
          <h2
            class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl"
          >
            <RevealText :text="t('public.home.faq.heading')" />
          </h2>
          <p
            class="mt-5 max-w-sm text-lg leading-relaxed text-muted-foreground"
          >
            {{ t("public.home.faq.description") }}
          </p>
          <NuxtLink
            to="/docs"
            class="mt-4 inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-emerald-600 transition-colors hover:text-emerald-500 dark:text-emerald-400"
          >
            {{ t("public.home.readDocs") }}
            <Icon name="lucide:arrow-up-right" class="h-4 w-4" />
          </NuxtLink>
        </div>

        <!-- open Q&A grid -->
        <dl
          class="grid gap-x-10 gap-y-9 sm:grid-cols-2"
          data-aos="fade-up"
          data-aos-delay="100"
        >
          <div v-for="f in faqs" :key="f.q">
            <dt class="flex gap-2 font-mono text-sm font-semibold">
              <span class="text-emerald-600 dark:text-emerald-400">?</span>
              <span>{{ f.q }}</span>
            </dt>
            <dd class="mt-2 text-sm leading-relaxed text-muted-foreground">
              {{ f.a }}
            </dd>
          </div>
        </dl>
      </div>
    </section>

    <!-- ───────────────────────────── CTA ───────────────────────────── -->
    <section>
      <div class="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div
          class="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-16 text-center shadow-2xl shadow-black/30 sm:px-16"
          data-aos="fade-up"
        >
          <div
            class="bp-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,black,transparent)]"
          />
          <div class="relative mx-auto max-w-2xl">
            <div class="font-mono text-sm text-emerald-400">
              <span class="text-zinc-500">$</span> lctl get-started<span
                class="caret"
                >▋</span
              >
            </div>
            <h2
              class="mt-5 font-mono text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl"
            >
              <RevealText :text="t('public.home.bottomCta.heading')" />
            </h2>
            <p class="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              {{ t("public.home.bottomCta.description") }}
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <NuxtLink
                :to="ctaTo"
                class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-mono text-sm font-semibold text-zinc-950 shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <span class="text-zinc-950/50">$</span>
                {{ t("public.home.bottomCta.getStarted") }}
                <Icon name="lucide:arrow-right" class="h-4 w-4" />
              </NuxtLink>
              <NuxtLink
                to="/pricing"
                class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 font-mono text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                {{ t("public.home.bottomCta.viewPricing") }}
              </NuxtLink>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* Blueprint grid — theme-aware via the --border token. */
.bp-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.6) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.6) 1px, transparent 1px);
  background-size: 3.5rem 3.5rem;
}
/* Always-dark grid for the dark CTA panel. */
.bp-grid-dark {
  background-image:
    linear-gradient(to right, rgb(255 255 255 / 0.06) 1px, transparent 1px),
    linear-gradient(to bottom, rgb(255 255 255 / 0.06) 1px, transparent 1px);
  background-size: 3rem 3rem;
}

@keyframes caretBlink {
  0%,
  49% {
    opacity: 1;
  }
  50%,
  100% {
    opacity: 0;
  }
}
.caret {
  animation: caretBlink 1.1s step-end infinite;
}

@keyframes termIn {
  from {
    opacity: 0;
    transform: translateY(4px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.term-line {
  opacity: 0;
  animation: termIn 0.4s ease forwards;
}

@media (prefers-reduced-motion: reduce) {
  .caret {
    animation: none;
  }
  .term-line {
    opacity: 1;
    animation: none;
  }
}
</style>
