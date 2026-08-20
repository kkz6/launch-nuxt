<script setup lang="ts">
definePageMeta({
  layout: "site",
});

const { t } = useI18n();

useHead({ title: () => t("public.pricing.pageTitle") });

useSeoMeta({
  description: () => t("public.pricing.metaDescription"),
  ogTitle: () => t("public.pricing.metaTitle"),
  ogDescription: () => t("public.pricing.metaDescription"),
  ogImage: "/images/og-image.png",
  ogUrl: "https://launchctl.io/pricing",
  ogType: "website",
  twitterTitle: () => t("public.pricing.metaTitle"),
  twitterDescription: () => t("public.pricing.metaDescription"),
  twitterImage: "/images/og-image.png",
  twitterCard: "summary_large_image",
});
</script>

<template>
  <div>
    <LandingPricingTables />
    <LandingFaqs />
    <LandingCtaAlternative
      class="overflow-hidden"
      :heading="t('public.pricing.ctaHeading')"
      :button-text="t('public.pricing.registerNow')"
      button-link="/register"
    />
  </div>
</template>
