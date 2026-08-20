<script setup lang="ts">
const { t } = useI18n();

const features = [
  {
    category: "serverManagement",
    icon: "M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01",
    items: [
      {
        key: "serverProvisioning",
      },
      { key: "serviceManagement" },
      {
        key: "phpVersions",
      },
      { key: "sshKeys" },
      { key: "firewall" },
      { key: "monitoring" },
    ],
  },
  {
    category: "applicationDeployment",
    icon: "M13 10V3L4 14h7v7l9-11h-7z",
    items: [
      { key: "zeroDowntime" },
      { key: "gitIntegration" },
      { key: "autoDeploy" },
      { key: "deploymentHistory" },
      { key: "environmentVariables" },
      { key: "deployScripts" },
    ],
  },
  {
    category: "databaseManagement",
    icon: "M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4",
    items: [
      { key: "engines" },
      { key: "users" },
      { key: "remoteAccess" },
      { key: "backups" },
    ],
  },
  {
    category: "dnsManagement",
    icon: "M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9",
    items: [{ key: "providers" }, { key: "records" }, { key: "health" }],
  },
  {
    category: "sslSecurity",
    icon: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z",
    items: [
      { key: "letsEncrypt" },
      { key: "customSsl" },
      { key: "sshAuthentication" },
      { key: "twoFactor" },
    ],
  },
  {
    category: "queuesSchedulers",
    icon: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
    items: [
      { key: "workers" },
      { key: "cron" },
      { key: "daemons" },
      { key: "autoRestart" },
    ],
  },
  {
    category: "monitoringLogs",
    icon: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z",
    items: [
      { key: "realtimeLogs" },
      { key: "deploymentLogs" },
      { key: "metrics" },
      { key: "notifications" },
    ],
  },
  {
    category: "teamCollaboration",
    icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
    items: [
      { key: "management" },
      { key: "activityLog" },
      { key: "multiTeam" },
    ],
  },
];
</script>

<template>
  <section class="site-section bg-[hsl(var(--site-bg))] py-16">
    <div class="site-grid-pattern absolute inset-0" />

    <div class="site-container relative">
      <div class="mb-10" data-aos="fade-up">
        <h2
          class="font-site mb-3 text-2xl font-bold text-[hsl(var(--site-text))]"
        >
          {{ t("public.docsFeatures.heading") }}
        </h2>
        <p class="text-sm text-[hsl(var(--site-text-muted))]">
          {{ t("public.docsFeatures.description") }}
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
              <svg
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  :stroke-width="1.5"
                  :d="feature.icon"
                />
              </svg>
            </div>
            <h3
              class="font-mono text-sm font-semibold text-[hsl(var(--site-text))]"
            >
              {{
                t(`public.docsFeatures.categories.${feature.category}.title`)
              }}
            </h3>
          </div>

          <ul class="space-y-2.5">
            <li
              v-for="item in feature.items"
              :key="item.key"
              class="flex items-start gap-2"
            >
              <span class="mt-1 text-xs text-emerald-400">→</span>
              <div>
                <span class="text-xs font-medium text-[hsl(var(--site-text))]">
                  {{
                    t(
                      `public.docsFeatures.categories.${feature.category}.items.${item.key}.name`,
                    )
                  }}
                </span>
                <span class="ml-1 text-xs text-[hsl(var(--site-text-muted))]">
                  —
                  {{
                    t(
                      `public.docsFeatures.categories.${feature.category}.items.${item.key}.description`,
                    )
                  }}
                </span>
              </div>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </section>
</template>
