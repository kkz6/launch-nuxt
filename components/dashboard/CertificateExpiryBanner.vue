<script setup lang="ts">
// CertificateExpiryBanner — surfaces stored certs in the team's
// library that are expiring (or already expired). Renders nothing
// when the list is empty so the dashboard stays clean.
//
// Mount this on the dashboard page (and other landing pages where
// the warning would be useful). It self-polls via
// useCertificateAlerts, so no props are needed.

import { useCertificateAlerts } from "~/composables/useCertificateAlerts";

const { expiringSoon, isLoading } = useCertificateAlerts();

const summary = computed(() => {
  const total = expiringSoon.value.length;
  if (total === 0) return "";
  const expired = expiringSoon.value.filter(
    (c) => new Date(c.not_after) < new Date(),
  ).length;
  if (expired === total) {
    return `${expired} ${expired === 1 ? "certificate has" : "certificates have"} expired`;
  }
  if (expired > 0) {
    return `${expired} expired, ${total - expired} expiring in the next 30 days`;
  }
  return `${total} ${total === 1 ? "certificate expires" : "certificates expire"} in the next 30 days`;
});

const variantClasses = computed(() => {
  const hasExpired = expiringSoon.value.some(
    (c) => new Date(c.not_after) < new Date(),
  );
  return hasExpired
    ? "border-destructive/40 bg-destructive/5 text-destructive"
    : "border-amber-500/40 bg-amber-50 text-amber-900 dark:bg-amber-950/30 dark:text-amber-200";
});
</script>

<template>
  <div
    v-if="!isLoading && expiringSoon.length > 0"
    :class="[
      'flex items-center justify-between gap-4 rounded-lg border px-4 py-3 text-sm',
      variantClasses,
    ]"
  >
    <div class="flex items-center gap-3">
      <Icon name="lucide:shield-alert" class="h-5 w-5 shrink-0" />
      <span>{{ summary }} — review your SSL certificates.</span>
    </div>
    <NuxtLink
      to="/settings/connections#ssl-certificates"
      class="shrink-0 rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-accent"
    >
      Review
    </NuxtLink>
  </div>
</template>
