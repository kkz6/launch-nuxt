<script setup lang="ts">
import { toast } from "vue-sonner";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();

useHead({ title: () => t("settings.billingReturn.pageTitle") });

const route = useRoute();
const { fetchUser } = useAuth();
const { open: openSettingsSheet } = useSettingsSheet();

const isProcessing = ref(true);
const subscriptionStatus = route.query.status as string | undefined;
const subscriptionId = route.query.subscription_id as string | undefined;
const isPaymentReturn = Boolean(subscriptionId && subscriptionStatus);

onMounted(async () => {
  if (isPaymentReturn && subscriptionStatus === "active") {
    // Refresh user data to pick up new subscription status from webhook
    await fetchUser();

    toast.success(t("settings.billingReturn.activatedToast"));

    // Brief delay so user sees the success state, then redirect
    setTimeout(() => {
      navigateTo("/dashboard");
      nextTick(() => openSettingsSheet("billing"));
    }, 1500);
  } else {
    // No payment params - just open the billing sheet on dashboard
    navigateTo("/dashboard");
    nextTick(() => openSettingsSheet("billing"));
  }

  isProcessing.value = false;
});
</script>

<template>
  <div class="flex flex-col items-center justify-center py-24">
    <template v-if="isPaymentReturn && subscriptionStatus === 'active'">
      <div class="flex flex-col items-center gap-4 text-center">
        <div
          class="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30"
        >
          <Icon
            name="lucide:check"
            class="h-8 w-8 text-emerald-600 dark:text-emerald-400"
          />
        </div>
        <h1 class="text-xl font-semibold">
          {{ t("settings.billingReturn.activatedTitle") }}
        </h1>
        <p class="text-sm text-muted-foreground">
          {{ t("settings.billingReturn.redirecting") }}
        </p>
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>
    </template>
    <template v-else>
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </template>
  </div>
</template>
