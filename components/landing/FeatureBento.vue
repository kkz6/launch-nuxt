<script setup lang="ts">
// Features — calm, spacious. Six headline capabilities, no categories,
// no chips, no logos. The long tail collapses into a single line so the
// breadth is acknowledged without crowding the page. Keeps the emerald
// accent and mono titles so it stays on-brand with the rest of the page.

const features = [
  {
    icon: 'lucide:git-branch',
    title: 'GitHub Actions CI/CD',
    desc: 'Build in Actions, push to GHCR and deploy to your box. Build load stays off production, and a fresh pull token is minted per deploy.',
  },
  {
    icon: 'lucide:box',
    title: 'Apps, compose & databases',
    desc: 'Single containers, multi-service compose stacks, and one-click managed Postgres, MySQL, MariaDB, Mongo and Redis.',
  },
  {
    icon: 'lucide:rocket',
    title: 'Zero-downtime & rollback',
    desc: 'Health-checked rollouts behind Traefik. Every deploy is a release, so you can roll back to any previous one in a click.',
  },
  {
    icon: 'lucide:square-terminal',
    title: 'Live logs & web terminal',
    desc: 'Stream colour-coded build, deploy and runtime logs in real time, and open a real shell into any container from the browser.',
  },
  {
    icon: 'lucide:hard-drive-download',
    title: 'Scheduled backups',
    desc: 'Cron or run-now database backups straight to S3-compatible storage, with retention rules and one-click restore.',
  },
  {
    icon: 'lucide:shield-check',
    title: 'SSL, domains & multi-cloud',
    desc: "Automatic Let's Encrypt certificates, domains and DNS — on servers you provision across DigitalOcean, Hetzner, AWS, Linode or Vultr.",
  },
]

const alsoIncluded =
  'queues · cron · daemons · metrics · firewall · SSH keys · env & secrets · volumes · notifications · teams & roles · file manager'
</script>

<template>
  <section class="border-b">
    <div class="mx-auto max-w-6xl px-6 py-28 lg:px-8">
      <!-- header -->
      <div class="mx-auto max-w-2xl text-center" data-aos="fade-up">
        <span class="font-mono text-xs text-emerald-600 dark:text-emerald-400">$ lctl --help</span>
        <h2 class="mt-3 font-mono text-3xl font-bold tracking-tight sm:text-4xl">
          Everything you need to ship
        </h2>
        <p class="mt-4 text-pretty text-lg text-muted-foreground">
          A full operations console for the servers you already own — build,
          run, observe and secure, in one calm workflow.
        </p>
      </div>

      <!-- six roomy cards -->
      <div class="mx-auto mt-20 grid max-w-5xl gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
        <div
          v-for="(f, i) in features"
          :key="f.title"
          data-aos="fade-up"
          :data-aos-delay="(i % 3) * 80"
        >
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20">
            <Icon :name="f.icon" class="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h3 class="mt-5 font-mono text-base font-semibold">{{ f.title }}</h3>
          <p class="mt-2 max-w-xs text-pretty text-sm leading-relaxed text-muted-foreground">
            {{ f.desc }}
          </p>
        </div>
      </div>

      <!-- long tail, one quiet line -->
      <p
        class="mx-auto mt-20 max-w-3xl text-center font-mono text-xs leading-relaxed text-muted-foreground/70"
        data-aos="fade-up"
      >
        <span class="text-muted-foreground"># and more</span> — {{ alsoIncluded }}
      </p>
    </div>
  </section>
</template>
