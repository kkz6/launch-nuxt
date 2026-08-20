<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  PinInput,
  PinInputGroup,
  PinInputSeparator,
  PinInputSlot,
} from "~/components/ui/pin-input";
import { authService } from "~/services/authService";

definePageMeta({
  layout: "guest",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.twoFactor.pageTitle"),
}));

const otpDigits = ref<number[]>([]);
const recoveryCode = ref("");
const isRecovery = ref(false);
const errors = ref<Record<string, string>>({});
const loading = ref(false);

const { setTokens } = useApi();
const { isInitialized, setUser } = useAuth();

// Get the challenge token from sessionStorage
const challengeToken = ref("");

onMounted(() => {
  challengeToken.value = sessionStorage.getItem("2fa_challenge_token") || "";
  if (!challengeToken.value) {
    navigateTo("/login");
  }
});

const handleSubmit = async (codeValue?: string) => {
  if (!challengeToken.value) {
    navigateTo("/login");
    return;
  }

  const code = codeValue ?? otpDigits.value.join("");

  if (!isRecovery.value && code.length !== 6) {
    return;
  }

  loading.value = true;
  errors.value = {};

  try {
    const body = isRecovery.value
      ? {
          challenge_token: challengeToken.value,
          recovery_code: recoveryCode.value,
        }
      : { challenge_token: challengeToken.value, code };

    const response = await authService.twoFactor.challenge(body);

    // Store tokens from the response
    setTokens(response.data.access_token, response.data.refresh_token);

    // Set user state and wait for the saved locale before rendering the
    // authenticated destination or its success toast.
    await setUser(response.data.user);
    isInitialized.value = true;

    // Clean up the challenge token
    sessionStorage.removeItem("2fa_challenge_token");

    toast.success(t("auth.login.signedIn"));
    navigateTo(response.data.user.onboarded ? "/dashboard" : "/onboarding");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      const key = isRecovery.value ? "recovery_code" : "code";
      if (fetchError.data?.errors?.[key]) {
        errors.value = { [key]: fetchError.data.errors[key][0] };
      } else {
        errors.value = {
          [key]: fetchError.data?.message || t("auth.errors.invalidCode"),
        };
      }
    } else {
      errors.value = { code: t("auth.errors.generic") };
    }
  } finally {
    loading.value = false;
  }
};

const onOtpComplete = (digits: number[]) => {
  handleSubmit(digits.join(""));
};

const toggleRecovery = () => {
  isRecovery.value = !isRecovery.value;
  otpDigits.value = [] as number[];
  recoveryCode.value = "";
  errors.value = {};
};
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      {{ t("auth.twoFactor.heading") }}
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{
        isRecovery
          ? t("auth.twoFactor.recoveryDescription")
          : t("auth.twoFactor.authDescription")
      }}
    </p>

    <form class="space-y-6" @submit.prevent="handleSubmit()">
      <div v-if="isRecovery" class="space-y-2">
        <Label for="recovery_code">{{ t("auth.fields.recoveryCode") }}</Label>
        <Input
          id="recovery_code"
          v-model="recoveryCode"
          type="text"
          autocomplete="one-time-code"
          autofocus
          required
        />
        <p v-if="errors.recovery_code" class="text-sm text-destructive">
          {{ errors.recovery_code }}
        </p>
      </div>

      <div v-else class="space-y-2">
        <Label>{{ t("auth.fields.authenticationCode") }}</Label>
        <div class="flex justify-center">
          <PinInput
            v-model="otpDigits"
            type="number"
            :length="6"
            autofocus
            @complete="onOtpComplete"
          >
            <PinInputGroup>
              <PinInputSlot
                v-for="(_, index) in 3"
                :key="index"
                :index="index"
              />
            </PinInputGroup>
            <PinInputSeparator />
            <PinInputGroup>
              <PinInputSlot
                v-for="(_, index) in 3"
                :key="index + 3"
                :index="index + 3"
              />
            </PinInputGroup>
          </PinInput>
        </div>
        <p v-if="errors.code" class="text-sm text-center text-destructive">
          {{ errors.code }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="loading">
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{ loading ? t("auth.actions.verifying") : t("auth.actions.verify") }}
      </Button>
    </form>

    <div class="mt-6 text-center">
      <button
        type="button"
        class="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        @click="toggleRecovery"
      >
        {{
          isRecovery
            ? t("auth.actions.useAuthenticationCode")
            : t("auth.actions.useRecoveryCode")
        }}
      </button>
    </div>
  </div>
</template>
