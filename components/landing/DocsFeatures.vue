<script setup lang="ts">
const features = [
  {
    category: 'Server Management',
    icon: 'M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01',
    items: [
      {
        name: 'Server Provisioning',
        desc: 'Connect AWS, DigitalOcean, Hetzner, Vultr, Linode or bring your own server',
      },
      { name: 'Service Management', desc: 'Start, stop, restart nginx, MySQL, Redis, and other services' },
      {
        name: 'PHP Version Management',
        desc: 'Install and switch between PHP versions (7.4, 8.0, 8.1, 8.2, 8.3)',
      },
      { name: 'SSH Key Management', desc: 'Add and manage SSH keys for secure server access' },
      { name: 'Firewall Rules', desc: 'Configure UFW firewall rules to secure your servers' },
      { name: 'Server Monitoring', desc: 'Real-time CPU, memory, and disk usage monitoring' },
    ],
  },
  {
    category: 'Application Deployment',
    icon: 'M13 10V3L4 14h7v7l9-11h-7z',
    items: [
      { name: 'Zero-Downtime Deployments', desc: 'Deploy without any interruption to your users' },
      { name: 'Git Integration', desc: 'Connect GitHub, GitLab, Bitbucket, or any Git repository' },
      { name: 'Auto-Deploy', desc: 'Automatically deploy on push to your configured branch' },
      { name: 'Deployment History', desc: 'View all past deployments with rollback capability' },
      { name: 'Environment Variables', desc: 'Securely manage .env files and secrets' },
      { name: 'Custom Deploy Scripts', desc: 'Run custom commands before and after deployment' },
    ],
  },
  {
    category: 'Database Management',
    icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4',
    items: [
      { name: 'MySQL & PostgreSQL', desc: 'Create and manage MySQL and PostgreSQL databases' },
      { name: 'Database Users', desc: 'Create users with specific database permissions' },
      { name: 'Remote Access', desc: 'Enable remote database access when needed' },
      {
        name: 'Database Backups',
        desc: 'Automated backups to S3, DigitalOcean Spaces, or local storage',
      },
    ],
  },
  {
    category: 'DNS Management',
    icon: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
    items: [
      { name: 'DNS Providers', desc: 'Connect Cloudflare, Route53, DigitalOcean DNS, and more' },
      { name: 'DNS Records', desc: 'Manage A, AAAA, CNAME, MX, TXT, and other record types' },
      { name: 'Domain Health', desc: 'Monitor domain propagation and health status' },
    ],
  },
  {
    category: 'SSL & Security',
    icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z',
    items: [
      { name: "Let's Encrypt SSL", desc: 'Free SSL certificates with automatic renewal' },
      { name: 'Custom SSL', desc: 'Upload your own SSL certificates' },
      { name: 'SSH Key Authentication', desc: 'Secure passwordless server access' },
      { name: 'Two-Factor Authentication', desc: 'Extra security for your Launch account' },
    ],
  },
  {
    category: 'Queues & Schedulers',
    icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
    items: [
      { name: 'Queue Workers', desc: 'Manage Laravel Horizon, Redis queues, and custom workers' },
      { name: 'Cron Jobs', desc: 'Schedule tasks with cron expression support' },
      { name: 'Daemons', desc: 'Run long-running processes with automatic restart' },
      { name: 'Auto-Restart', desc: 'Automatically restart workers after deployment' },
    ],
  },
  {
    category: 'Monitoring & Logs',
    icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
    items: [
      { name: 'Real-Time Logs', desc: 'Stream nginx, PHP-FPM, and application logs' },
      { name: 'Deployment Logs', desc: 'Detailed logs for every deployment step' },
      { name: 'Server Metrics', desc: 'CPU, memory, disk, and network monitoring' },
      { name: 'Notifications', desc: 'Slack, email, and webhook notifications for events' },
    ],
  },
  {
    category: 'Team Collaboration',
    icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z',
    items: [
      { name: 'Team Management', desc: 'Invite team members with role-based permissions' },
      { name: 'Activity Log', desc: 'Track all actions performed by team members' },
      { name: 'Multi-Team Support', desc: 'Organize projects across multiple teams' },
    ],
  },
]
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="mb-10" data-aos="fade-up">
        <h2 class="font-site mb-3 text-2xl font-bold text-[hsl(var(--site-text))]">Features</h2>
        <p class="text-sm text-[hsl(var(--site-text-muted))]">
          Complete feature reference for the Launch deployment platform.
        </p>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <div
          v-for="(feature, idx) in features"
          :key="feature.category"
          class="site-card rounded-lg p-5"
          data-aos="fade-up"
          :data-aos-delay="idx * 50"
        >
          <div class="mb-4 flex items-center gap-3">
            <div
              class="flex h-8 w-8 items-center justify-center rounded border border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
            >
              <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="1.5"
                  :d="feature.icon"
                />
              </svg>
            </div>
            <h3 class="font-mono text-sm font-semibold text-[hsl(var(--site-text))]">
              {{ feature.category }}
            </h3>
          </div>

          <ul class="space-y-2.5">
            <li v-for="item in feature.items" :key="item.name" class="flex items-start gap-2">
              <span class="mt-1 text-xs text-emerald-400">→</span>
              <div>
                <span class="text-xs font-medium text-[hsl(var(--site-text))]">
                  {{ item.name }}
                </span>
                <span class="ml-1 text-xs text-[hsl(var(--site-text-muted))]"> — {{ item.desc }} </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
