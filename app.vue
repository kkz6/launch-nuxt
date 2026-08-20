<script setup lang="ts">
const { locale, t } = useI18n();

useHead(() => ({
  htmlAttrs: {
    lang: locale.value === "ja" ? "ja-JP" : "en-US",
  },
}));

useSeoMeta({
  description: () => t("public.meta.description"),
  ogDescription: () => t("public.meta.description"),
  twitterDescription: () => t("public.meta.description"),
});
</script>

<template>
  <NuxtLoadingIndicator color="hsl(var(--primary))" :height="2" />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
