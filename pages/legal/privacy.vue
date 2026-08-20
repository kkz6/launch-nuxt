<script setup lang="ts">
definePageMeta({ layout: "site" });

const { t, locale } = useI18n();
const updated = computed(() =>
  new Intl.DateTimeFormat(locale.value === "ja" ? "ja-JP" : "en-US", {
    dateStyle: "long",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(2026, 5, 11))),
);

useHead({ title: () => t("public.legal.privacy.title") });
useSeoMeta({
  description: () => t("public.legal.privacy.metaDescription"),
});
</script>

<template>
  <LegalDoc
    :title="t('public.legal.privacy.title')"
    :updated="updated"
    :intro="t('public.legal.privacy.intro')"
  >
    <h2>{{ t("public.legal.privacy.sections.who.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.who.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.collect.heading") }}</h2>
    <ul>
      <li>
        <strong>{{
          t("public.legal.privacy.sections.collect.accountLabel")
        }}</strong
        >{{ t("public.legal.privacy.sections.collect.accountBody") }}
      </li>
      <li>
        <strong>{{
          t("public.legal.privacy.sections.collect.billingLabel")
        }}</strong
        >{{ t("public.legal.privacy.sections.collect.billingBody") }}
      </li>
      <li>
        <strong>{{
          t("public.legal.privacy.sections.collect.credentialsLabel")
        }}</strong
        >{{ t("public.legal.privacy.sections.collect.credentialsBody") }}
      </li>
      <li>
        <strong>{{
          t("public.legal.privacy.sections.collect.usageLabel")
        }}</strong
        >{{ t("public.legal.privacy.sections.collect.usageBody") }}
      </li>
      <li>
        <strong>{{
          t("public.legal.privacy.sections.collect.communicationsLabel")
        }}</strong
        >{{ t("public.legal.privacy.sections.collect.communicationsBody") }}
      </li>
    </ul>

    <h2>{{ t("public.legal.privacy.sections.use.heading") }}</h2>
    <ul>
      <li>{{ t("public.legal.privacy.sections.use.platform") }}</li>
      <li>{{ t("public.legal.privacy.sections.use.billing") }}</li>
      <li>{{ t("public.legal.privacy.sections.use.support") }}</li>
      <li>{{ t("public.legal.privacy.sections.use.reliability") }}</li>
      <li>{{ t("public.legal.privacy.sections.use.legal") }}</li>
    </ul>
    <p>{{ t("public.legal.privacy.sections.use.noSale") }}</p>

    <h2>{{ t("public.legal.privacy.sections.ownership.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.ownership.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.share.heading") }}</h2>
    <p>{{ t("public.legal.privacy.sections.share.intro") }}</p>
    <ul>
      <li>
        <strong>Polar</strong
        >{{ t("public.legal.privacy.sections.share.polar") }}
      </li>
      <li>
        {{ t("public.legal.privacy.sections.share.connectedProviders") }}
      </li>
      <li>
        {{ t("public.legal.privacy.sections.share.infrastructure") }}
      </li>
      <li>
        {{ t("public.legal.privacy.sections.share.authorities") }}
      </li>
    </ul>

    <h2>{{ t("public.legal.privacy.sections.retention.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.retention.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.security.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.security.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.rights.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.rights.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.cookies.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.cookies.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.changes.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.changes.body") }}
    </p>

    <h2>{{ t("public.legal.privacy.sections.contact.heading") }}</h2>
    <p>
      {{ t("public.legal.privacy.sections.contact.beforeEmail") }}
      <a href="mailto:support@launchctl.io">support@launchctl.io</a>
      {{ t("public.legal.privacy.sections.contact.between") }}
      <NuxtLink to="/support">{{ t("public.legal.contactForm") }}</NuxtLink
      >.
    </p>
  </LegalDoc>
</template>
