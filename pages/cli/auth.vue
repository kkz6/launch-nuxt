<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { deviceAuthService } from "~/services/deviceAuthService";
import type { DeviceAuthorizationResponse } from "~/services/deviceAuthService";

definePageMeta({ layout: "guest", middleware: "device-auth" });

const { t } = useI18n();
const { user } = useAuth();
useHead(() => ({ title: t("auth.cli.pageTitle") }));

const userCode = ref("");
const securityCode = ref("");
const loading = ref(false);
const decision = ref<DeviceAuthorizationResponse["status"] | null>(null);
const errors = ref<Record<string, string>>({});
const serverRequiresTwoFactor = ref(false);
const needsTwoFactor = computed(
  () => user.value?.two_factor_enabled || serverRequiresTwoFactor.value,
);

const authorize = async (approve: boolean) => {
  if (loading.value || decision.value) return;
  errors.value = {};

  const code = userCode.value.trim();
  if (!/^\d{8}$/.test(code)) {
    errors.value.user_code = t("auth.cli.invalidCode");
    return;
  }
  if (approve && needsTwoFactor.value && !securityCode.value.trim()) {
    errors.value.code = t("auth.cli.securityCodeRequired");
    return;
  }

  loading.value = true;
  try {
    const response = await deviceAuthService.authorize({
      user_code: code,
      approve,
      ...(approve && securityCode.value.trim()
        ? { code: securityCode.value.trim() }
        : {}),
    });
    decision.value = response.data.status;
    userCode.value = "";
    securityCode.value = "";
  } catch (error: unknown) {
    const failure = error as {
      response?: { status?: number };
      data?: { message?: string; errors?: Record<string, string[]> };
    };
    if (failure?.response?.status === 401) {
      await navigateTo({ path: "/login", query: { redirect: "/cli/auth" } });
      return;
    }
    for (const key of ["user_code", "code"]) {
      if (failure?.data?.errors?.[key]?.[0]) {
        errors.value[key] = failure.data.errors[key][0];
      }
    }
    if (errors.value.code) {
      serverRequiresTwoFactor.value = true;
      securityCode.value = "";
    }
    if (!Object.keys(errors.value).length) {
      errors.value.form = failure?.data?.message || t("auth.cli.failed");
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <NuxtLink to="/" class="mb-8 inline-block text-2xl font-bold">
      launchctl
    </NuxtLink>

    <div v-if="decision" role="status" class="space-y-3">
      <Icon
        :name="
          decision === 'approved' ? 'lucide:circle-check' : 'lucide:circle-x'
        "
        class="h-8 w-8 text-primary"
        aria-hidden="true"
      />
      <h1 class="text-lg font-semibold">
        {{ t(`auth.cli.${decision}Title`) }}
      </h1>
      <p class="text-sm text-muted-foreground">
        {{ t(`auth.cli.${decision}Description`) }}
      </p>
    </div>

    <template v-else>
      <h1 class="mb-2 text-lg font-semibold">{{ t("auth.cli.heading") }}</h1>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("auth.cli.description") }}
      </p>
      <p v-if="user?.email" class="mb-6 break-words text-sm">
        {{ t("auth.cli.signedInAs", { email: user.email }) }}
      </p>

      <form class="space-y-5" @submit.prevent="authorize(true)">
        <div class="space-y-2">
          <Label for="cli-user-code">{{ t("auth.cli.codeLabel") }}</Label>
          <Input
            id="cli-user-code"
            v-model="userCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]{8}"
            maxlength="8"
            autocomplete="off"
            class="font-mono text-lg tracking-widest"
            :disabled="loading"
            :aria-invalid="!!errors.user_code"
            aria-describedby="cli-code-help cli-code-error"
            required
          />
          <p id="cli-code-help" class="text-sm text-muted-foreground">
            {{ t("auth.cli.codeHelp") }}
          </p>
          <p
            v-if="errors.user_code"
            id="cli-code-error"
            role="alert"
            class="text-sm text-destructive"
          >
            {{ errors.user_code }}
          </p>
        </div>

        <div v-if="needsTwoFactor" class="space-y-2">
          <Label for="cli-security-code">{{
            t("auth.cli.securityCodeLabel")
          }}</Label>
          <Input
            id="cli-security-code"
            v-model="securityCode"
            type="text"
            autocomplete="one-time-code"
            :disabled="loading"
            :aria-invalid="!!errors.code"
            aria-describedby="cli-security-help cli-security-error"
          />
          <p id="cli-security-help" class="text-sm text-muted-foreground">
            {{ t("auth.cli.securityCodeHelp") }}
          </p>
          <p
            v-if="errors.code"
            id="cli-security-error"
            role="alert"
            class="text-sm text-destructive"
          >
            {{ errors.code }}
          </p>
        </div>

        <p class="text-sm text-muted-foreground">
          {{ t("auth.cli.permission") }}
        </p>
        <p v-if="errors.form" role="alert" class="text-sm text-destructive">
          {{ errors.form }}
        </p>
        <div class="flex gap-3">
          <Button
            type="button"
            variant="outline"
            class="flex-1"
            :disabled="loading"
            @click="authorize(false)"
          >
            {{ t("auth.cli.deny") }}
          </Button>
          <Button type="submit" class="flex-1" :disabled="loading">
            <Icon
              v-if="loading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
              aria-hidden="true"
            />
            {{ t("auth.cli.approve") }}
          </Button>
        </div>
      </form>
    </template>
  </div>
</template>
