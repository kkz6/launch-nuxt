<script setup lang="ts">
definePageMeta({ layout: "site" });

const { t, locale } = useI18n();
const updated = computed(() =>
  new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 5, 11))),
);

useHead({ title: () => t("public.legal.refund.title") });
useSeoMeta({
  description: () => t("public.legal.refund.metaDescription"),
});
</script>

<template>
  <LegalDoc
    :title="t('public.legal.refund.title')"
    :updated="updated"
    :intro="t('public.legal.refund.intro')"
  >
    <p class="lead">
      <strong>{{ t("public.legal.refund.leadTitle") }}</strong
      >{{ t("public.legal.refund.leadBody") }}
    </p>

    <h2>{{ t("public.legal.refund.request.heading") }}</h2>
    <p>
      {{ t("public.legal.refund.request.beforeEmail") }}
      <a href="mailto:support@launchctl.io">support@launchctl.io</a
      >{{ t("public.legal.refund.request.between") }}
      <NuxtLink to="/support">{{ t("public.legal.contactForm") }}</NuxtLink
      >{{ t("public.legal.refund.request.afterForm") }}
    </p>

    <h2>{{ t("public.legal.refund.covered.heading") }}</h2>
    <ul>
      <li>{{ t("public.legal.refund.covered.subscription") }}</li>
      <li>{{ t("public.legal.refund.covered.full") }}</li>
      <li>{{ t("public.legal.refund.covered.effect") }}</li>
    </ul>

    <h2>{{ t("public.legal.refund.notCovered.heading") }}</h2>
    <p>
      {{ t("public.legal.refund.notCovered.body") }}
    </p>

    <h2>{{ t("public.legal.refund.beyond.heading") }}</h2>
    <p>
      {{ t("public.legal.refund.beyond.body") }}
    </p>

    <h2>{{ t("public.legal.refund.questions.heading") }}</h2>
    <p>
      {{ t("public.legal.refund.questions.beforeEmail") }}
      <a href="mailto:support@launchctl.io">support@launchctl.io</a
      >{{ t("public.legal.refund.questions.afterEmail") }}
    </p>
  </LegalDoc>
</template>
