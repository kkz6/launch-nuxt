<script setup lang="ts">
import { toast } from "vue-sonner";
import { authService } from "~/services/authService";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const { user, fetchUser } = useAuth();
const { t } = useI18n();

const isLoading = ref(false);
const enabling = ref(false);
const confirming = ref(false);
const disabling = ref(false);
const qrCode = ref<string | null>(null);
const setupKey = ref<string | null>(null);
const recoveryCodes = ref<string[]>([]);
const showingRecoveryCodes = ref(false);
const otpCode = ref("");
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const twoFactorEnabled = computed(() => {
  return !enabling.value && user.value?.two_factor_enabled;
});

const enableTwoFactorAuthentication = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.twoFactor.enableTitle"),
    description: t("settings.twoFactor.enableDescription"),
    confirmText: t("settings.twoFactor.enable"),
    cancelText: t("settings.twoFactor.cancel"),
    hasInput: true,
    inputType: "password",
    helpText: t("settings.twoFactor.passwordHelp"),
  });

  if (!result.ok || !result.value) return;

  enabling.value = true;
  try {
    const response = await authService.twoFactor.enable(result.value);
    qrCode.value = response.data.qr_code_url;
    setupKey.value = response.data.secret_key;
    confirming.value = true;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.twoFactor.enableFailed"));
  } finally {
    enabling.value = false;
  }
};

const confirmTwoFactorAuthentication = async () => {
  if (!otpCode.value || otpCode.value.length !== 6) {
    toast.error(t("settings.twoFactor.codeInvalid"));
    return;
  }

  isLoading.value = true;
  try {
    const response = await authService.twoFactor.confirm(otpCode.value);
    recoveryCodes.value = response.data.recovery_codes || [];
    showingRecoveryCodes.value = true;
    qrCode.value = null;
    setupKey.value = null;
    otpCode.value = "";
    await fetchUser();
    confirming.value = false;
    toast.success(t("settings.twoFactor.enabled"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.twoFactor.confirmFailed"));
  } finally {
    isLoading.value = false;
  }
};

const regenerateRecoveryCodes = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.twoFactor.regenerateTitle"),
    description: t("settings.twoFactor.regenerateDescription"),
    confirmText: t("settings.twoFactor.regenerate"),
    cancelText: t("settings.twoFactor.cancel"),
    hasInput: true,
    inputType: "password",
    helpText: t("settings.twoFactor.passwordHelp"),
  });

  if (!result.ok) return;

  isLoading.value = true;
  try {
    const response = await authService.twoFactor.regenerateRecoveryCodes();
    recoveryCodes.value = response.data.recovery_codes || [];
    showingRecoveryCodes.value = true;
    toast.success(t("settings.twoFactor.codesRegenerated"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.twoFactor.regenerateFailed"));
  } finally {
    isLoading.value = false;
  }
};

const disableTwoFactorAuthentication = async () => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.twoFactor.disableTitle"),
    description: t("settings.twoFactor.disableDescription"),
    confirmText: t("settings.twoFactor.disable"),
    cancelText: t("settings.twoFactor.cancel"),
    destructive: true,
    hasInput: true,
    inputType: "password",
    helpText: t("settings.twoFactor.passwordHelp"),
  });

  if (!result.ok || !result.value) return;

  disabling.value = true;
  try {
    await authService.twoFactor.disable(result.value);
    confirming.value = false;
    recoveryCodes.value = [];
    showingRecoveryCodes.value = false;
    await fetchUser();
    toast.success(t("settings.twoFactor.disabled"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.twoFactor.disableFailed"));
  } finally {
    disabling.value = false;
  }
};

const toggleRecoveryCodes = () => {
  showingRecoveryCodes.value = !showingRecoveryCodes.value;
};
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <p class="text-sm text-muted-foreground">
      {{ t("settings.twoFactor.description") }}
    </p>

    <div class="text-sm">
      <template v-if="twoFactorEnabled && !confirming">
        <span class="font-medium text-green-600 dark:text-green-400">{{
          t("settings.twoFactor.enabledStatus")
        }}</span>
      </template>
      <template v-else-if="confirming">
        <span class="font-medium text-amber-600 dark:text-amber-400">{{
          t("settings.twoFactor.finishingStatus")
        }}</span>
      </template>
      <template v-else>
        <span class="text-muted-foreground">{{
          t("settings.twoFactor.disabledStatus")
        }}</span>
      </template>
    </div>

    <div v-if="twoFactorEnabled || confirming">
      <div v-if="qrCode" class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ t("settings.twoFactor.setupDescription") }}
        </p>

        <div class="flex flex-col items-start gap-4">
          <img
            :src="qrCode"
            :alt="t('settings.twoFactor.qrCodeAlt')"
            class="rounded-lg"
            width="200"
            height="200"
          />
          <span v-if="setupKey" class="text-sm text-muted-foreground">
            {{ t("settings.twoFactor.setupKey") }}
            <code class="rounded bg-muted px-1 py-0.5 font-mono text-xs">{{
              setupKey
            }}</code>
          </span>
        </div>

        <div class="max-w-xs space-y-2">
          <Label for="otp-code">{{
            t("settings.twoFactor.verificationCode")
          }}</Label>
          <Input
            id="otp-code"
            v-model="otpCode"
            type="text"
            inputmode="numeric"
            pattern="[0-9]*"
            maxlength="6"
            :placeholder="t('settings.twoFactor.codePlaceholder')"
            class="font-mono"
          />
        </div>
      </div>

      <div
        v-if="recoveryCodes.length > 0 && !confirming && showingRecoveryCodes"
        class="mt-4 space-y-2"
      >
        <p class="text-sm text-muted-foreground">
          {{ t("settings.twoFactor.recoveryDescription") }}
        </p>
        <div class="grid gap-1 rounded-lg bg-muted px-3 py-3 font-mono text-xs">
          <div v-for="code in recoveryCodes" :key="code">
            {{ code }}
          </div>
        </div>
      </div>
    </div>

    <div class="flex flex-wrap gap-2">
      <template v-if="!twoFactorEnabled && !confirming">
        <Button
          type="button"
          size="sm"
          :disabled="enabling"
          @click="enableTwoFactorAuthentication"
        >
          <Icon
            v-if="enabling"
            name="lucide:loader-2"
            class="mr-1 block size-4 animate-spin"
          />
          {{ t("settings.twoFactor.enable") }}
        </Button>
      </template>
      <template v-else-if="confirming">
        <Button
          type="button"
          size="sm"
          :disabled="isLoading"
          @click="confirmTwoFactorAuthentication"
        >
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-1 block size-4 animate-spin"
          />
          {{ t("settings.twoFactor.confirm") }}
        </Button>
      </template>
      <template v-else>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          :disabled="disabling"
          @click="disableTwoFactorAuthentication"
        >
          <Icon
            v-if="disabling"
            name="lucide:loader-2"
            class="mr-1 block size-4 animate-spin"
          />
          {{ t("settings.twoFactor.disable") }}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="isLoading"
          @click="regenerateRecoveryCodes"
        >
          {{ t("settings.twoFactor.regenerateCodes") }}
        </Button>
        <Button
          v-if="recoveryCodes.length > 0"
          type="button"
          variant="outline"
          size="sm"
          @click="toggleRecoveryCodes"
        >
          {{
            showingRecoveryCodes
              ? t("settings.twoFactor.hideCodes")
              : t("settings.twoFactor.showCodes")
          }}
        </Button>
      </template>
    </div>
  </div>
</template>
