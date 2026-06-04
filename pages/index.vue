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
definePageMeta({ layout: 'site' })

// Note: nuxt.config sets titleTemplate "%s - launchctl", so the title
// here must NOT repeat the brand or it doubles up.
useHead({ title: 'Ship to your own servers' })
useSeoMeta({
  description:
    'Provision servers on any cloud, build in GitHub Actions or on-server, and deploy Docker apps, compose stacks and managed databases — with live logs, queue workers, scheduled backups, web terminal access, automatic SSL and zero-downtime rollouts.',
  ogTitle: 'launchctl — your servers, deployed properly',
  ogDescription:
    'Provision, build, deploy and operate Docker apps, compose stacks and managed databases on your own servers. CI/CD, live logs, queues, backups, terminal access, SSL — without the platform tax.',
  ogImage: '/images/og-image.png',
  ogUrl: 'https://launchctl.dev',
  ogType: 'website',
  twitterTitle: 'launchctl — your servers, deployed properly',
  twitterDescription:
    'Provision, build, deploy and operate Docker apps, compose stacks and managed databases on your own servers. CI/CD, live logs, queues, backups, terminal access, SSL — without the platform tax.',
  twitterImage: '/images/og-image.png',
  twitterCard: 'summary_large_image',
})

const { isAuthenticated } = useAuth()
const ctaTo = computed(() => (isAuthenticated.value ? '/servers' : '/register'))

const clouds = ['DigitalOcean', 'Hetzner', 'AWS', 'Linode', 'Vultr']

const stack = [
  { src: '/images/services/docker.svg', label: 'docker' },
  { src: '/images/services/postgresql.svg', label: 'postgres' },
  { src: '/images/services/mysql.svg', label: 'mysql' },
  { src: '/images/services/memory_database.svg', label: 'redis' },
  { src: '/images/services/node.svg', label: 'node' },
  { src: '/images/services/php.svg', label: 'php' },
  { src: '/images/services/bun.svg', label: 'bun' },
  { src: '/images/services/traefik.svg', label: 'traefik' },
]

// Hero deploy run — streamed line by line via CSS.
const deployRun = [
  { mark: '▸', mcls: 'text-zinc-500', k: 'commit', v: '9f2c1ab', tail: 'main', tcls: 'text-zinc-500' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'build', v: 'GitHub Actions', tail: 'ok', tcls: 'text-emerald-400' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'push', v: 'ghcr.io/gigcodes/gj-hrms-api:9f2c', tail: '', tcls: '' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'deploy', v: 'recreate · 82.180.145.26', tail: 'ok', tcls: 'text-emerald-400' },
]

// GitHub Actions CI run — the second terminal.
const ciRun = [
  { mark: '✓', mcls: 'text-emerald-400', k: 'trigger', v: 'launch-deploy.yml', tail: '', tcls: '' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'build', v: 'docker buildx', tail: '42s', tcls: 'text-zinc-500' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'push', v: 'ghcr.io · private', tail: 'ok', tcls: 'text-emerald-400' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'notify', v: 'launchctl webhook', tail: '200', tcls: 'text-cyan-400' },
  { mark: '▸', mcls: 'text-zinc-500', k: 'pull', v: 'short-lived token', tail: 'ok', tcls: 'text-emerald-400' },
]

// Capabilities, framed as console commands. Covers the breadth of the
// platform — build/deploy, data, and day-2 operations — not just deploys.
const commands = [
  {
    cmd: 'lctl ci:enable',
    icon: 'lucide:git-branch',
    title: 'GitHub Actions CI/CD',
    desc: 'Build in CI, push to GHCR, deploy to your box automatically. A fresh pull token is minted per deploy — no long-lived PAT to manage.',
  },
  {
    cmd: 'lctl up <app|compose|db>',
    icon: 'lucide:box',
    title: 'Apps, compose & databases',
    desc: 'Single containers, multi-service compose stacks, and one-click managed Postgres, MySQL, MariaDB, MongoDB & Redis.',
  },
  {
    cmd: 'lctl deploy --zero-downtime',
    icon: 'lucide:rocket',
    title: 'Zero-downtime deploys',
    desc: 'Health-checked rollouts behind Traefik, so traffic only moves to a container once it reports healthy.',
  },
  {
    cmd: 'lctl rollback <release>',
    icon: 'lucide:rotate-ccw',
    title: 'Instant rollback',
    desc: 'Every deploy is a release. Roll back to any previous one in a click when something looks wrong.',
  },
  {
    cmd: 'lctl logs --follow',
    icon: 'lucide:scroll-text',
    title: 'Live, colour-coded logs',
    desc: 'Stream build, deploy and runtime logs in real time — ANSI-coloured, searchable, with pause and download.',
  },
  {
    cmd: 'lctl ssh',
    icon: 'lucide:square-terminal',
    title: 'Web terminal access',
    desc: 'A real shell into your server, app, compose or database container — straight from the browser, no local SSH setup.',
  },
  {
    cmd: 'lctl queue:work',
    icon: 'lucide:list-checks',
    title: 'Queue workers & logs',
    desc: 'Run and supervise background queue workers — with auto-restart, Horizon support and live worker logs.',
  },
  {
    cmd: 'lctl backup --schedule',
    icon: 'lucide:hard-drive-download',
    title: 'Scheduled backups',
    desc: 'Cron or run-now database backups straight to S3-compatible storage, with live progress and one-click restore.',
  },
  {
    cmd: 'lctl metrics',
    icon: 'lucide:gauge',
    title: 'Metrics & monitoring',
    desc: 'CPU, memory and storage at a glance, with health status across every server, app and database.',
  },
  {
    cmd: 'lctl ssl:auto',
    icon: 'lucide:shield-check',
    title: 'Automatic SSL',
    desc: "Let's Encrypt certificates issued and renewed for you — or bring your own from the stored-certificate library.",
  },
  {
    cmd: 'lctl domains add',
    icon: 'lucide:globe',
    title: 'Domains & redirects',
    desc: 'Bind multiple domains per workload and set up HTTP redirects — TLS wired up automatically.',
  },
  {
    cmd: 'lctl server:provision',
    icon: 'lucide:cloud',
    title: 'Multi-cloud provisioning',
    desc: 'Spin up servers on DigitalOcean, Hetzner, AWS, Linode or Vultr — firewall, cron, SSH keys and monitoring handled.',
  },
]

// The long tail — everything else that ships in the box.
const moreFeatures = [
  'firewall rules',
  'cron & schedulers',
  'daemons / supervisor',
  'SSH keys',
  'volumes & mounts',
  'env vars & build secrets',
  'DNS records',
  'notifications · slack · discord · telegram',
  'teams & roles',
  'file manager',
  'run commands',
  'stored TLS certs',
]

const ciPoints = [
  'No long-lived tokens — a fresh pull token is minted per deploy',
  'Builds never touch your production server',
  'Committing or syncing the workflow never auto-ships — deploys are explicit',
]

const steps = [
  {
    no: '01',
    cmd: 'server:provision',
    title: 'Provision a server',
    desc: 'Connect a cloud account and launch a fully-provisioned host — Docker, Traefik, firewall and SSH set up for you.',
  },
  {
    no: '02',
    cmd: 'app:configure',
    title: 'Configure your app',
    desc: 'Point at a repo or image, set env vars and domains, and pick a build method — Dockerfile, Nixpacks or GitHub Actions.',
  },
  {
    no: '03',
    cmd: 'deploy',
    title: 'Ship it',
    desc: 'Run the deploy and watch the build and rollout stream live, then your app is online behind automatic SSL.',
  },
]

const controlChips = ['live logs', 'web terminal', 'queue logs', 'backups → s3', 'rollback', 'metrics']

const logLines = [
  { t: '12:45:14', lvl: 'INF', cls: 'text-emerald-400', msg: 'starting api server…' },
  { t: '12:45:14', lvl: 'DBG', cls: 'text-cyan-400', msg: 'connected to postgres' },
  { t: '12:45:15', lvl: 'INF', cls: 'text-emerald-400', msg: 'listening on :8080' },
  { t: '12:45:21', lvl: 'WRN', cls: 'text-amber-400', msg: 'queue worker restarted' },
  { t: '12:45:49', lvl: 'INF', cls: 'text-emerald-400', msg: 'deploy succeeded · health ok' },
]

const faqs = [
  {
    q: 'Where do my apps actually run?',
    a: 'On servers you own, in your own cloud account. launchctl provisions and operates them for you, but the infrastructure and data stay yours.',
  },
  {
    q: 'Do I need to manage GitHub tokens for CI/CD?',
    a: 'No. We commit a managed GitHub Actions workflow that builds and pushes to GHCR, and mints a short-lived pull token per deploy — no long-lived PAT to set up or rotate.',
  },
  {
    q: 'Does committing the workflow trigger a deploy?',
    a: 'Never. The workflow runs on workflow_dispatch only, so syncing the file or pushing code never auto-ships. Deploys are always explicit.',
  },
  {
    q: 'Which databases are supported?',
    a: 'Managed PostgreSQL, MySQL, MariaDB, MongoDB and Redis — each with scheduled S3 backups, one-click restore and connection details on tap.',
  },
]
</script>

<template>
  <div class="bg-background text-foreground">
    <!-- ───────────────────────── Hero ───────────────────────── -->
    <section class="relative overflow-hidden border-b">
      <div class="bp-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_75%_60%_at_50%_0%,black,transparent)]" />
      <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-emerald-500/[0.04] to-transparent" />

      <div class="relative mx-auto max-w-6xl px-6 pb-24 pt-24 lg:px-8 lg:pt-28">
        <div class="mx-auto max-w-3xl text-center" data-aos="fade-up">
          <div class="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-1.5 font-mono text-xs shadow-sm">
            <span class="text-emerald-600 dark:text-emerald-400">$</span>
            <span class="text-foreground">lctl</span>
            <span class="text-muted-foreground">deploy --to your-own-servers</span>
          </div>

          <h1 class="mt-7 font-mono text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            Your servers,<br >deployed properly.<span class="caret text-emerald-500">_</span>
          </h1>
          <p class="mx-auto mt-6 max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground">
            Provision on any cloud, build in CI or on-server, and ship Docker
            apps, compose stacks and managed databases — with live logs, queue
            workers, backups, web terminal access and automatic SSL. Without
            the platform tax.
          </p>

          <div class="mt-9 flex flex-wrap items-center justify-center gap-3">
            <NuxtLink
              :to="ctaTo"
              class="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-mono text-sm font-semibold text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5"
            >
              <span class="text-primary-foreground/60">$</span> get-started
              <Icon name="lucide:arrow-right" class="h-4 w-4" />
            </NuxtLink>
            <NuxtLink
              to="/support"
              class="inline-flex items-center gap-2 rounded-lg border bg-card px-5 py-3 font-mono text-sm font-semibold transition-colors hover:bg-muted"
            >
              <Icon name="lucide:book-open" class="h-4 w-4" />
              read the docs
            </NuxtLink>
          </div>
          <p class="mt-4 font-mono text-xs text-muted-foreground">
            # no credit card required · bring your own cloud
          </p>
        </div>

        <!-- Hero terminal: a deploy streaming live -->
        <div class="mx-auto mt-16 max-w-3xl" data-aos="fade-up" data-aos-delay="120">
          <div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-2xl shadow-black/30">
            <div class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
              <span class="h-3 w-3 rounded-full bg-rose-400/80" />
              <span class="h-3 w-3 rounded-full bg-amber-400/80" />
              <span class="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span class="ml-3 font-mono text-xs text-zinc-500">lctl — deploy gj-hrms-api</span>
              <span class="ml-auto inline-flex items-center gap-1.5 font-mono text-xs text-emerald-400">
                <span class="h-1.5 w-1.5 rounded-full bg-emerald-400" /> live
              </span>
            </div>
            <div class="space-y-2 p-5 font-mono text-sm sm:p-6">
              <div class="term-line text-zinc-100" :style="{ animationDelay: '0ms' }">
                <span class="text-emerald-400">$</span> lctl deploy gj-hrms-api <span class="text-zinc-500">--prod</span>
              </div>
              <div
                v-for="(s, i) in deployRun"
                :key="s.k"
                class="term-line flex items-center gap-3"
                :style="{ animationDelay: (i + 1) * 260 + 'ms' }"
              >
                <span :class="s.mcls">{{ s.mark }}</span>
                <span class="w-16 shrink-0 text-zinc-400">{{ s.k }}</span>
                <span class="flex-1 truncate text-zinc-300">{{ s.v }}</span>
                <span v-if="s.tail" :class="s.tcls">{{ s.tail }}</span>
              </div>
              <div class="term-line flex items-center gap-3 pt-1" :style="{ animationDelay: (deployRun.length + 1) * 260 + 'ms' }">
                <span class="text-emerald-400">✓</span>
                <span class="w-16 shrink-0 text-emerald-400">live</span>
                <span class="flex-1 truncate text-cyan-400">https://hrms.example.com</span>
                <span class="text-zinc-500">health ok</span>
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
          # runs on your cloud — {{ clouds.join(' · ') }}
        </p>
        <div class="mt-7 flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
          <div
            v-for="t in stack"
            :key="t.label"
            class="flex items-center gap-2 opacity-60 grayscale transition hover:opacity-100 hover:grayscale-0"
          >
            <img :src="t.src" :alt="t.label" class="h-6 w-6" >
            <span class="font-mono text-sm text-muted-foreground">{{ t.label }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ──────────────────── GitHub Actions CI/CD ──────────────────── -->
    <section class="border-b">
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:px-8">
        <div data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># ci/cd</span>
          <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            Build in Actions.<br >Deploy to your box.
          </h2>
          <p class="mt-5 text-lg leading-relaxed text-muted-foreground">
            Pick <span class="font-mono text-sm font-medium text-foreground">github_actions</span> as your
            build method and we commit a managed workflow to your repo. It builds
            your image, pushes to GHCR and deploys to your server — keeping build
            load off production and your registry private.
          </p>
          <ul class="mt-7 space-y-3">
            <li v-for="t in ciPoints" :key="t" class="flex items-start gap-3">
              <Icon name="lucide:check" class="mt-1 h-4 w-4 shrink-0 text-emerald-500" />
              <span class="text-sm text-muted-foreground">{{ t }}</span>
            </li>
          </ul>
        </div>

        <!-- CI run terminal -->
        <div data-aos="fade-up" data-aos-delay="120">
          <div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/20">
            <div class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
              <span class="h-3 w-3 rounded-full bg-rose-400/80" />
              <span class="h-3 w-3 rounded-full bg-amber-400/80" />
              <span class="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span class="ml-3 font-mono text-xs text-zinc-500">actions — launch-deploy.yml</span>
            </div>
            <div class="space-y-2 p-5 font-mono text-sm sm:p-6">
              <div class="text-zinc-100">
                <span class="text-emerald-400">$</span> git push origin main
              </div>
              <div v-for="s in ciRun" :key="s.k" class="flex items-center gap-3">
                <span :class="s.mcls">{{ s.mark }}</span>
                <span class="w-16 shrink-0 text-zinc-400">{{ s.k }}</span>
                <span class="flex-1 truncate text-zinc-300">{{ s.v }}</span>
                <span v-if="s.tail" :class="s.tcls">{{ s.tail }}</span>
              </div>
              <div class="flex items-center gap-3 pt-1">
                <span class="text-emerald-400">✓</span>
                <span class="text-emerald-400">gj-hrms-api is live</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────────────── Features as commands ───────────────── -->
    <section class="relative border-b bg-muted/20">
      <div class="bp-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_50%,black,transparent)]" />
      <div class="relative mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400">$ lctl --help</span>
          <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            One platform, every command
          </h2>
          <p class="mt-4 text-lg text-muted-foreground">
            From provision to production — build, deploy, data, TLS and
            day-2 operations — in a single, calm workflow.
          </p>
        </div>

        <div class="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="(c, i) in commands"
            :key="c.cmd"
            class="group overflow-hidden rounded-lg border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md"
            data-aos="fade-up"
            :data-aos-delay="(i % 3) * 70"
          >
            <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 font-mono text-xs">
              <Icon :name="c.icon" class="h-3.5 w-3.5 text-muted-foreground" />
              <span class="text-emerald-600 dark:text-emerald-400">$</span>
              <span class="truncate text-foreground">{{ c.cmd }}</span>
            </div>
            <div class="p-5">
              <h3 class="font-mono text-sm font-semibold">{{ c.title }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ c.desc }}</p>
            </div>
          </div>
        </div>

        <!-- The long tail of features -->
        <div class="mt-10" data-aos="fade-up">
          <p class="text-center font-mono text-xs text-muted-foreground"># also included</p>
          <div class="mt-5 flex flex-wrap justify-center gap-2">
            <span
              v-for="f in moreFeatures"
              :key="f"
              class="rounded-md border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground"
            >
              {{ f }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ──────────────────────── How it works ──────────────────────── -->
    <section class="border-b">
      <div class="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># how-it-works</span>
          <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">Live in three steps</h2>
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
              <span class="text-emerald-600 dark:text-emerald-400">$ lctl {{ s.cmd }}</span>
              <span class="text-muted-foreground/40"># {{ s.no }}</span>
            </div>
            <h3 class="mt-5 font-mono text-lg font-semibold">{{ s.title }}</h3>
            <p class="mt-2 text-sm leading-relaxed text-muted-foreground">{{ s.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ─────────────── Deep dive: logs & control ─────────────── -->
    <section class="border-b bg-muted/20">
      <div class="mx-auto grid max-w-6xl items-center gap-12 px-6 py-24 lg:grid-cols-2 lg:px-8">
        <div class="order-2 lg:order-1" data-aos="fade-up">
          <div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 shadow-xl shadow-black/20">
            <div class="flex items-center gap-2 border-b border-zinc-800 px-4 py-2.5">
              <span class="h-3 w-3 rounded-full bg-rose-400/80" />
              <span class="h-3 w-3 rounded-full bg-amber-400/80" />
              <span class="h-3 w-3 rounded-full bg-emerald-400/80" />
              <span class="ml-3 font-mono text-xs text-zinc-500">lctl logs — gj-hrms-api -f</span>
            </div>
            <div class="space-y-1.5 p-5 font-mono text-xs leading-relaxed sm:text-sm">
              <div v-for="l in logLines" :key="l.t + l.msg">
                <span class="text-zinc-600">{{ l.t }}</span>
                <span :class="l.cls"> {{ l.lvl }}</span>
                <span class="text-zinc-300"> {{ l.msg }}</span>
              </div>
              <div class="text-zinc-100"><span class="text-emerald-400">$</span> <span class="caret">▋</span></div>
            </div>
          </div>
        </div>

        <div class="order-1 lg:order-2" data-aos="fade-up" data-aos-delay="120">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># observe &amp; control</span>
          <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
            See everything.<br >Change it in a click.
          </h2>
          <p class="mt-5 text-lg leading-relaxed text-muted-foreground">
            Tail build, deploy, runtime and queue-worker logs live — colour-coded
            and searchable. Open a web terminal into any container, watch server
            metrics, roll back to any release, and give databases scheduled S3
            backups with one-click restore.
          </p>
          <div class="mt-7 flex flex-wrap gap-2">
            <span v-for="chip in controlChips" :key="chip" class="rounded-md border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground">{{ chip }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ───────────────────────────── FAQ ───────────────────────────── -->
    <section class="border-b">
      <div class="mx-auto max-w-3xl px-6 py-24 lg:px-8">
        <div class="text-center" data-aos="fade-up">
          <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400"># faq</span>
          <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">Good questions</h2>
        </div>
        <div class="mt-12 divide-y rounded-lg border bg-card" data-aos="fade-up">
          <details v-for="f in faqs" :key="f.q" class="group p-6">
            <summary class="flex cursor-pointer list-none items-center justify-between gap-4 font-mono text-sm font-medium">
              <span><span class="text-emerald-600 dark:text-emerald-400">?</span> {{ f.q }}</span>
              <Icon name="lucide:plus" class="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-45" />
            </summary>
            <p class="mt-3 text-sm leading-relaxed text-muted-foreground">{{ f.a }}</p>
          </details>
        </div>
      </div>
    </section>

    <!-- ───────────────────────────── CTA ───────────────────────────── -->
    <section>
      <div class="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div class="relative overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 px-6 py-16 text-center shadow-2xl shadow-black/30 sm:px-16" data-aos="fade-up">
          <div class="bp-grid-dark pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_70%_80%_at_50%_0%,black,transparent)]" />
          <div class="relative mx-auto max-w-2xl">
            <div class="font-mono text-sm text-emerald-400">
              <span class="text-zinc-500">$</span> lctl get-started<span class="caret">▋</span>
            </div>
            <h2 class="mt-5 font-mono text-3xl font-bold tracking-tight text-zinc-50 sm:text-4xl">
              Deploy your first app today
            </h2>
            <p class="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
              Connect a server, point at a repo, and ship — with CI/CD, live
              logs and backups handled for you.
            </p>
            <div class="mt-8 flex flex-wrap items-center justify-center gap-3">
              <NuxtLink
                :to="ctaTo"
                class="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-5 py-3 font-mono text-sm font-semibold text-zinc-950 shadow-sm transition-transform hover:-translate-y-0.5"
              >
                <span class="text-zinc-950/50">$</span> get-started
                <Icon name="lucide:arrow-right" class="h-4 w-4" />
              </NuxtLink>
              <NuxtLink
                to="/pricing"
                class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-3 font-mono text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-800"
              >
                view pricing
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
  0%, 49% { opacity: 1; }
  50%, 100% { opacity: 0; }
}
.caret {
  animation: caretBlink 1.1s step-end infinite;
}

@keyframes termIn {
  from { opacity: 0; transform: translateY(4px); }
  to { opacity: 1; transform: none; }
}
.term-line {
  opacity: 0;
  animation: termIn 0.4s ease forwards;
}

@media (prefers-reduced-motion: reduce) {
  .caret { animation: none; }
  .term-line { opacity: 1; animation: none; }
}
</style>
