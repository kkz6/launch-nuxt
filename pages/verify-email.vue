<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { authService } from "~/services/authService";

definePageMeta({
  layout: "guest",
  middleware: "auth",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.verifyEmail.pageTitle"),
}));

const { logout } = useAuth();

const loading = ref(false);
const status = ref("");

const handleResend = async () => {
  loading.value = true;
  status.value = "";

  try {
    await authService.resendVerification();
    status.value = "verification-link-sent";
    toast.success(t("auth.verifyEmail.linkSent"));
  } catch {
    toast.error(t("auth.errors.verificationSendFailed"));
  } finally {
    loading.value = false;
  }
};

const handleLogout = async () => {
  await logout();
};
</script>

<template>
  <div>
    <Alert v-if="status === 'verification-link-sent'" class="mb-6">
      <Icon name="lucide:info" class="h-4 w-4" />
      <AlertDescription>
        {{ t("auth.verifyEmail.newLinkSent") }}
      </AlertDescription>
    </Alert>

    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      {{ t("auth.verifyEmail.heading") }}
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{ t("auth.verifyEmail.description") }}
    </p>

    <div class="space-y-4">
      <Button
        type="button"
        class="w-full"
        :disabled="loading"
        @click="handleResend"
      >
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{
          loading
            ? t("auth.actions.sending")
            : t("auth.actions.resendVerification")
        }}
      </Button>

      <Button
        type="button"
        variant="outline"
        class="w-full"
        @click="handleLogout"
      >
        {{ t("auth.actions.logOut") }}
      </Button>
    </div>
  </div>
</template>
