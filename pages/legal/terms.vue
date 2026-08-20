<script setup lang="ts">
definePageMeta({ layout: "site" });

const { t, locale } = useI18n();
const updated = computed(() =>
  new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 5, 11))),
);

useHead({ title: () => t("public.legal.terms.title") });
useSeoMeta({
  description: () => t("public.legal.terms.metaDescription"),
});
</script>

<template>
  <LegalDoc
    :title="t('public.legal.terms.title')"
    :updated="updated"
    :intro="t('public.legal.terms.intro')"
  >
    <h2>{{ t("public.legal.terms.sections.service.heading") }}</h2>
    <p>
      {{ t("public.legal.terms.sections.service.body") }}
    </p>

    <h2>{{ t("public.legal.terms.sections.account.heading") }}</h2>
    <ul>
      <li>{{ t("public.legal.terms.sections.account.accurate") }}</li>
      <li>{{ t("public.legal.terms.sections.account.security") }}</li>
      <li>{{ t("public.legal.terms.sections.account.age") }}</li>
    </ul>

    <h2>{{ t("public.legal.terms.sections.responsibilities.heading") }}</h2>
    <p>
      {{ t("public.legal.terms.sections.responsibilities.intro") }}
    </p>
    <ul>
      <li>{{ t("public.legal.terms.sections.responsibilities.content") }}</li>
      <li>{{ t("public.legal.terms.sections.responsibilities.charges") }}</li>
      <li>{{ t("public.legal.terms.sections.responsibilities.providers") }}</li>
    </ul>

    <h2>{{ t("public.legal.terms.sections.acceptable.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.acceptable.intro") }}</p>
    <ul>
      <li>{{ t("public.legal.terms.sections.acceptable.law") }}</li>
      <li>{{ t("public.legal.terms.sections.acceptable.malware") }}</li>
      <li>{{ t("public.legal.terms.sections.acceptable.abuse") }}</li>
    </ul>

    <h2>{{ t("public.legal.terms.sections.billing.heading") }}</h2>
    <ul>
      <li>{{ t("public.legal.terms.sections.billing.renewal") }}</li>
      <li>{{ t("public.legal.terms.sections.billing.cancellation") }}</li>
      <li>{{ t("public.legal.terms.sections.billing.taxes") }}</li>
      <li>
        {{ t("public.legal.terms.sections.billing.refundBefore") }}
        <NuxtLink to="/legal/refund">{{
          t("public.legal.refund.title")
        }}</NuxtLink
        >{{ t("public.legal.terms.sections.billing.refundAfter") }}
      </li>
    </ul>

    <h2>{{ t("public.legal.terms.sections.thirdParty.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.thirdParty.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.ip.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.ip.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.disclaimers.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.disclaimers.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.liability.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.liability.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.termination.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.termination.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.changes.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.changes.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.governing.heading") }}</h2>
    <p>{{ t("public.legal.terms.sections.governing.body") }}</p>

    <h2>{{ t("public.legal.terms.sections.contact.heading") }}</h2>
    <p>
      {{ t("public.legal.terms.sections.contact.beforeEmail") }}
      <a href="mailto:support@launchctl.io">support@launchctl.io</a>
      {{ t("public.legal.terms.sections.contact.between") }}
      <NuxtLink to="/support">{{ t("public.legal.contactForm") }}</NuxtLink
      >.
    </p>
  </LegalDoc>
</template>
