<script setup lang="ts">
const sourceControlApps = [
  {
    name: 'GitHub',
    description:
      'GitHub, the most popular version control system, used by millions worldwide for code collaboration and project management.',
    image: '/images/site/integration-1.svg',
    badge: true,
  },
  {
    name: 'GitLab',
    description:
      'GitLab, an all-in-one DevOps platform, allows teams to collaborate, build, and deploy code efficiently.',
    image: '/images/site/integration-3.svg',
    badge: false,
  },
  {
    name: 'Bitbucket',
    description:
      'Bitbucket, a Git solution designed for professional teams, enables source code collaboration.',
    image: '/images/site/integration-5.svg',
    badge: false,
  },
]

const cloudProviderApps = [
  {
    name: 'DigitalOcean',
    description:
      'DigitalOcean, a cloud infrastructure provider, helps developers build, deploy, and scale applications easily.',
    image: '/images/site/integration-6.svg',
    badge: true,
  },
  {
    name: 'Linode',
    description: 'Linode offers simple and affordable cloud hosting solutions for developers.',
    image: '/images/site/integration-8.svg',
    badge: false,
  },
  {
    name: 'Vultr',
    description: 'Vultr provides cloud servers with ultra-fast performance and global availability.',
    image: '/images/site/integration-9.svg',
    badge: true,
  },
  {
    name: 'Hetzner',
    description: 'Hetzner is a leading provider of dedicated servers and cloud hosting.',
    image: '/images/site/integration-7.svg',
    badge: true,
  },
  {
    name: 'AWS',
    description: 'AWS (Amazon Web Services) offers a comprehensive set of cloud services.',
    image: '/images/site/integration-4.svg',
    badge: false,
  },
]
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="space-y-16">
        <section data-aos="fade-up">
          <div class="mb-8 flex items-center gap-3">
            <span class="h-2 w-2 rounded-full bg-emerald-400" />
            <h2 class="font-site text-2xl font-bold text-[hsl(var(--site-text))]">Source Control</h2>
          </div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(app, index) in sourceControlApps"
              :key="app.name"
              data-aos="fade-up"
              :data-aos-delay="index * 100"
            >
              <LandingAppCard :app="app">
                {{ app.description }}
              </LandingAppCard>
            </div>
          </div>
        </section>

        <section data-aos="fade-up">
          <div class="mb-8 flex items-center gap-3">
            <span class="h-2 w-2 rounded-full bg-cyan-400" />
            <h2 class="font-site text-2xl font-bold text-[hsl(var(--site-text))]">Cloud Providers</h2>
          </div>
          <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <div
              v-for="(app, index) in cloudProviderApps"
              :key="app.name"
              data-aos="fade-up"
              :data-aos-delay="index * 100"
            >
              <LandingAppCard :app="app">
                {{ app.description }}
              </LandingAppCard>
            </div>
          </div>
        </section>
      </div>
    </div>
  </section>
</template>
