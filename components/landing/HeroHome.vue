<script setup lang="ts">
const terminalRef = ref<HTMLDivElement | null>(null)

onMounted(() => {
  const terminal = terminalRef.value
  if (!terminal) return

  const lines = terminal.querySelectorAll('.terminal-line')
  lines.forEach((line, index) => {
    ;(line as HTMLElement).style.animationDelay = `${index * 0.8}s`
  })
})

const providers = ['AWS', 'DigitalOcean', 'Hetzner', 'Vultr', 'Linode']
</script>

<template>
  <section class="site-section flex min-h-screen items-center bg-[hsl(var(--site-bg))]">
    <div class="site-grid-pattern absolute inset-0" />
    <div class="site-noise pointer-events-none absolute inset-0" />

    <div class="site-glow -left-40 -top-40 h-[600px] w-[600px] bg-emerald-500" />
    <div class="site-glow right-0 top-1/2 h-[500px] w-[500px] translate-x-1/2 bg-cyan-500" />
    <div class="site-glow bottom-0 left-1/3 h-[400px] w-[400px] bg-violet-500 opacity-20" />

    <div class="site-container relative pb-20 pt-32">
      <div class="grid items-center gap-16 lg:grid-cols-2">
        <div class="space-y-8" data-aos="fade-right" data-aos-duration="1000">
          <div
            class="inline-flex items-center gap-2 rounded border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 font-mono text-xs text-emerald-400"
          >
            <span class="relative flex h-1.5 w-1.5">
              <span
                class="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"
              />
              <span class="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
            Zero-Downtime Deployments
          </div>

          <h1 class="font-site-heading text-4xl font-bold leading-[1.1] tracking-tight md:text-5xl lg:text-6xl">
            <span class="text-[hsl(var(--site-text))]">Deploy at</span>
            <br />
            <span class="site-text-gradient">Light Speed</span>
          </h1>

          <p class="max-w-lg text-base leading-relaxed text-[hsl(var(--site-text-muted))] md:text-lg">
            Ship your applications without the DevOps complexity. One platform for CI/CD, server
            management, and monitoring.
          </p>

          <div class="flex flex-wrap gap-4">
            <NuxtLink to="/register" class="btn btn-site-primary group">
              Start Deploying Free
              <svg
                class="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="2"
                  d="M13 7l5 5m0 0l-5 5m5-5H6"
                />
              </svg>
            </NuxtLink>
            <NuxtLink to="/pricing" class="btn btn-site-secondary"> View Pricing </NuxtLink>
          </div>
        </div>

        <div class="relative" data-aos="fade-left" data-aos-duration="1000" data-aos-delay="200">
          <div class="absolute inset-0 rounded-lg bg-emerald-500/10 blur-3xl" />

          <div class="site-card relative overflow-hidden rounded-lg p-0.5">
            <div class="overflow-hidden rounded-md bg-[hsl(220,20%,6%)]">
              <div class="flex items-center gap-2 border-b border-white/5 px-4 py-3">
                <div class="flex gap-1.5">
                  <div class="h-3 w-3 rounded-full bg-red-500/80" />
                  <div class="h-3 w-3 rounded-full bg-yellow-500/80" />
                  <div class="h-3 w-3 rounded-full bg-green-500/80" />
                </div>
                <div class="flex-1 text-center">
                  <span class="font-mono text-xs text-white/40"> launch.gigcodes.com </span>
                </div>
              </div>

              <div ref="terminalRef" class="min-h-[280px] space-y-2.5 p-5 font-mono text-xs">
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] opacity-0">
                  <span class="text-emerald-400">→</span>
                  <span class="ml-2 text-white/80"> launch deploy --production </span>
                </div>
                <div
                  class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] space-y-1 pl-4 opacity-0"
                >
                  <div class="text-white/50">⠋ Building application...</div>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] pl-4 opacity-0">
                  <span class="text-emerald-400">✓</span>
                  <span class="ml-2 text-white/60"> Build completed in 23s </span>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] pl-4 opacity-0">
                  <span class="text-emerald-400">✓</span>
                  <span class="ml-2 text-white/60"> Running health checks... </span>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] pl-4 opacity-0">
                  <span class="text-emerald-400">✓</span>
                  <span class="ml-2 text-white/60"> Deploying to 3 servers </span>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] mt-4 opacity-0">
                  <span class="text-cyan-400">✨</span>
                  <span class="ml-2 text-white"> Deployment successful! </span>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] mt-2 pl-4 opacity-0">
                  <span class="text-white/40">Live at:</span>
                  <span class="ml-2 text-emerald-400"> https://my-app.com </span>
                </div>
                <div class="terminal-line animate-[fadeInUp_0.5s_ease-out_forwards] mt-6 opacity-0">
                  <span class="text-emerald-400">→</span>
                  <span class="ml-2 animate-pulse text-white/30">_</span>
                </div>
              </div>
            </div>
          </div>

          <div class="absolute -bottom-6 -right-6 h-24 w-24 rounded-lg bg-emerald-500/20 blur-2xl" />
        </div>
      </div>

      <div class="mt-20 border-t border-[hsl(var(--site-border))] pt-12">
        <p class="mb-6 text-center font-mono text-xs text-[hsl(var(--site-text-muted))]">
          Supports deployment to
        </p>
        <div class="flex flex-wrap items-center justify-center gap-10 opacity-50">
          <div
            v-for="provider in providers"
            :key="provider"
            class="font-mono text-sm tracking-wider text-[hsl(var(--site-text))]"
          >
            {{ provider }}
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
