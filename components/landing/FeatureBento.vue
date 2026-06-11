<script setup lang="ts">
// Categorised feature bento — surfaces the full breadth of the platform
// without the generic 3-up card grid. Each band is one capability area
// with an asymmetric layout: a wide "lead" tile + two narrow tiles, all
// keeping the terminal / `lctl` motif so it stays on-brand with the rest
// of the landing page. Built on shadcn tokens so light + dark both work.

interface Tile {
  cmd: string
  icon: string
  title: string
  desc: string
  /** sub-capabilities shown as small mono chips on the lead tile */
  chips?: string[]
  /** brand logos to render on the lead tile (e.g. db engines) */
  logos?: { src: string; label: string }[]
}

interface Band {
  label: string
  blurb: string
  tiles: [Tile, Tile, Tile]
}

const bands: Band[] = [
  {
    label: 'build & ship',
    blurb: 'From a commit to a healthy container, the boring parts handled.',
    tiles: [
      {
        cmd: 'lctl ci:enable',
        icon: 'lucide:git-branch',
        title: 'GitHub Actions CI/CD',
        desc: 'A managed workflow builds your image, pushes it to GHCR and deploys to your box — build load never touches production, and a fresh pull token is minted per deploy.',
        chips: ['Dockerfile', 'Nixpacks', 'on-server builds', 'GHCR'],
      },
      {
        cmd: 'lctl deploy --zero-downtime',
        icon: 'lucide:rocket',
        title: 'Zero-downtime rollouts',
        desc: 'Health-checked behind Traefik — traffic only moves once the new container reports healthy.',
      },
      {
        cmd: 'lctl rollback <release>',
        icon: 'lucide:rotate-ccw',
        title: 'Instant rollback',
        desc: 'Every deploy is a release. Step back to any previous one in a click.',
      },
    ],
  },
  {
    label: 'run anything',
    blurb: 'Single containers, full compose stacks, managed data — same console.',
    tiles: [
      {
        cmd: 'lctl up <app|compose|db>',
        icon: 'lucide:box',
        title: 'Apps, compose & databases',
        desc: 'Deploy single containers, multi-service compose stacks, and one-click managed databases — each provisioned, networked and wired to TLS for you.',
        logos: [
          { src: '/images/services/docker.svg', label: 'docker' },
          { src: '/images/services/postgresql.svg', label: 'postgres' },
          { src: '/images/services/mysql.svg', label: 'mysql' },
          { src: '/images/services/memory_database.svg', label: 'redis' },
        ],
      },
      {
        cmd: 'lctl queue:work',
        icon: 'lucide:list-checks',
        title: 'Queues & daemons',
        desc: 'Supervised queue workers with auto-restart and Horizon support, plus long-running daemons.',
      },
      {
        cmd: 'lctl cron:add',
        icon: 'lucide:clock',
        title: 'Schedulers & cron',
        desc: 'Per-app cron entries and scheduled tasks, edited from the dashboard.',
      },
    ],
  },
  {
    label: 'data & storage',
    blurb: 'Your databases, backed up and restorable — without leaving the panel.',
    tiles: [
      {
        cmd: 'lctl backup --schedule',
        icon: 'lucide:hard-drive-download',
        title: 'Scheduled S3 backups',
        desc: 'Cron or run-now dumps straight to S3-compatible storage, with live progress, retention rules and one-click restore into a fresh instance.',
        chips: ['cron or run-now', 'retention', 'one-click restore', 'encrypted'],
      },
      {
        cmd: 'lctl db:databases',
        icon: 'lucide:database',
        title: 'Manage databases',
        desc: 'Create and drop logical databases inside a running engine — live, no SSH.',
      },
      {
        cmd: 'lctl volumes',
        icon: 'lucide:layers',
        title: 'Volumes & mounts',
        desc: 'Named volumes and bind mounts that survive recreates, with the data path on tap.',
      },
    ],
  },
  {
    label: 'observe & operate',
    blurb: 'See exactly what is happening, and change it from the browser.',
    tiles: [
      {
        cmd: 'lctl logs --follow',
        icon: 'lucide:scroll-text',
        title: 'Live, colour-coded logs',
        desc: 'Stream build, deploy, runtime and worker logs in real time — ANSI-coloured, searchable, with pause and download, plus a live GitHub Actions step timeline.',
        chips: ['build', 'deploy', 'runtime', 'queue', 'gha steps'],
      },
      {
        cmd: 'lctl ssh',
        icon: 'lucide:square-terminal',
        title: 'Web terminal',
        desc: 'A real shell into any server or container, straight from the browser.',
      },
      {
        cmd: 'lctl metrics',
        icon: 'lucide:gauge',
        title: 'Metrics & health',
        desc: 'CPU, memory and storage at a glance, with health across every workload.',
      },
    ],
  },
  {
    label: 'network & secure',
    blurb: 'TLS, domains and access — set up correctly by default.',
    tiles: [
      {
        cmd: 'lctl ssl:auto',
        icon: 'lucide:shield-check',
        title: 'Automatic SSL',
        desc: "Let's Encrypt certificates issued and renewed for you, or bring your own from the stored-certificate library — wired to every domain you bind.",
        chips: ["let's encrypt", 'auto-renew', 'stored certs', 'redirects'],
      },
      {
        cmd: 'lctl domains add',
        icon: 'lucide:globe',
        title: 'Domains & DNS',
        desc: 'Bind multiple domains per workload and manage DNS records from connected providers.',
      },
      {
        cmd: 'lctl firewall',
        icon: 'lucide:lock',
        title: 'Firewall & secrets',
        desc: 'UFW rules, SSH keys, env vars and write-only build secrets, all managed in-app.',
      },
    ],
  },
  {
    label: 'team & platform',
    blurb: 'Run it with your team, on the cloud you already pay for.',
    tiles: [
      {
        cmd: 'lctl team invite',
        icon: 'lucide:users',
        title: 'Teams & roles',
        desc: 'Invite teammates with member, editor or admin roles — every action and button is gated to what each role can do, enforced server-side.',
        chips: ['member', 'editor', 'admin', 'owner'],
      },
      {
        cmd: 'lctl notify',
        icon: 'lucide:bell',
        title: 'Notifications',
        desc: 'Deploy and health alerts to Slack, Discord or Telegram.',
      },
      {
        cmd: 'lctl server:provision',
        icon: 'lucide:cloud',
        title: 'Multi-cloud',
        desc: 'Provision on DigitalOcean, Hetzner, AWS, Linode or Vultr — fully set up.',
      },
    ],
  },
]

// The genuinely long tail — small stuff that still ships in the box.
const alsoIncluded = [
  'file manager',
  'run commands',
  'env vars',
  'build secrets',
  'health checks',
  'resource limits',
  'restart policies',
  'connection strings',
  'image registries',
  'source control apps',
]
</script>

<template>
  <section class="relative border-b bg-muted/20">
    <div
      class="bp-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_80%_70%_at_50%_30%,black,transparent)]"
    />
    <div class="relative mx-auto max-w-6xl px-6 py-24 lg:px-8">
      <!-- Section header -->
      <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400">$ lctl --help</span>
        <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Everything in the box
        </h2>
        <p class="mt-4 text-pretty text-lg text-muted-foreground">
          Not a deploy button bolted onto a host. A full operations console —
          build, run, data, observability, networking and team — for the servers
          you already own.
        </p>
      </div>

      <!-- Capability bands -->
      <div class="mt-16 space-y-14">
        <div v-for="(band, bi) in bands" :key="band.label" data-aos="fade-up" :data-aos-delay="bi % 2 ? 60 : 0">
          <!-- band label -->
          <div class="flex items-baseline gap-3 border-b pb-3">
            <span class="font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              # {{ band.label }}
            </span>
            <span class="hidden text-sm text-muted-foreground sm:inline">{{ band.blurb }}</span>
          </div>

          <!-- asymmetric tiles: one wide lead + two narrow -->
          <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <!-- lead tile -->
            <article
              class="group relative flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md sm:col-span-2 lg:col-span-2 lg:row-span-1"
            >
              <div
                class="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-500/[0.07] blur-2xl transition-opacity group-hover:bg-emerald-500/[0.12]"
              />
              <div class="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5 font-mono text-xs">
                <Icon :name="band.tiles[0].icon" class="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span class="text-emerald-600 dark:text-emerald-400">$</span>
                <span class="truncate text-foreground">{{ band.tiles[0].cmd }}</span>
              </div>
              <div class="relative flex flex-1 flex-col p-5">
                <h3 class="font-mono text-base font-semibold">{{ band.tiles[0].title }}</h3>
                <p class="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {{ band.tiles[0].desc }}
                </p>

                <!-- optional brand logos -->
                <div v-if="band.tiles[0].logos" class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
                  <div
                    v-for="l in band.tiles[0].logos"
                    :key="l.label"
                    class="flex items-center gap-1.5 opacity-70 grayscale transition group-hover:opacity-100 group-hover:grayscale-0"
                  >
                    <img :src="l.src" :alt="l.label" class="h-5 w-5" >
                    <span class="font-mono text-xs text-muted-foreground">{{ l.label }}</span>
                  </div>
                  <span class="font-mono text-xs text-muted-foreground/60">+ mariadb · mongo</span>
                </div>

                <!-- optional sub-capability chips -->
                <div v-else-if="band.tiles[0].chips" class="mt-auto flex flex-wrap gap-1.5 pt-4">
                  <span
                    v-for="ch in band.tiles[0].chips"
                    :key="ch"
                    class="rounded border bg-muted/50 px-2 py-0.5 font-mono text-[11px] text-muted-foreground"
                  >
                    {{ ch }}
                  </span>
                </div>
              </div>
            </article>

            <!-- two narrow tiles -->
            <article
              v-for="tile in band.tiles.slice(1)"
              :key="tile.cmd"
              class="group flex flex-col overflow-hidden rounded-xl border bg-card shadow-sm transition-all hover:-translate-y-0.5 hover:border-emerald-500/40 hover:shadow-md"
            >
              <div class="flex items-center gap-2 border-b bg-muted/40 px-3.5 py-2.5 font-mono text-[11px]">
                <Icon :name="tile.icon" class="h-3.5 w-3.5 text-muted-foreground" />
                <span class="text-emerald-600 dark:text-emerald-400">$</span>
                <span class="truncate text-foreground">{{ tile.cmd }}</span>
              </div>
              <div class="flex flex-1 flex-col p-4">
                <h3 class="font-mono text-sm font-semibold">{{ tile.title }}</h3>
                <p class="mt-1.5 text-sm leading-relaxed text-muted-foreground">{{ tile.desc }}</p>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- long tail -->
      <div class="mt-14" data-aos="fade-up">
        <p class="text-center font-mono text-xs text-muted-foreground"># also included</p>
        <div class="mx-auto mt-5 flex max-w-3xl flex-wrap justify-center gap-2">
          <span
            v-for="f in alsoIncluded"
            :key="f"
            class="rounded-md border bg-card px-3 py-1.5 font-mono text-xs text-muted-foreground"
          >
            {{ f }}
          </span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.bp-grid {
  background-image:
    linear-gradient(to right, hsl(var(--border) / 0.6) 1px, transparent 1px),
    linear-gradient(to bottom, hsl(var(--border) / 0.6) 1px, transparent 1px);
  background-size: 3.5rem 3.5rem;
}
</style>
