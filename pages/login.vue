<script setup lang="ts">
import { toast } from "vue-sonner";
import { AnimatePresence, Motion } from "motion-v";
import {
  base64UrlToArrayBuffer,
  arrayBufferToBase64Url,
} from "~/utils/webauthn";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";
import { Separator } from "~/components/ui/separator";

definePageMeta({
  layout: "guest",
  middleware: "guest",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.login.pageTitle"),
}));

const email = ref("");
const password = ref("");
const remember = ref(false);
const passwordInputRef = ref<{ $el: HTMLInputElement } | null>(null);
const errors = ref<Record<string, string>>({});
const loading = ref(false);
const showPasswordField = ref(false);
const userHasPasskeys = ref(false);
const showPasskeyOption = ref(false);
const passkeyLoading = ref(false);

const { login, checkUserStatus, isLoading: authLoading } = useAuth();

const redirectAfterLogin = (onboarded: boolean) => {
  navigateTo(onboarded ? "/dashboard" : "/onboarding");
};

const handleEmailSubmit = async () => {
  if (!email.value) return;

  loading.value = true;
  errors.value = {};

  try {
    const status = await checkUserStatus(email.value);

    if (!status.user_exists) {
      errors.value = { email: t("auth.errors.accountNotFound") };
      return;
    }

    userHasPasskeys.value = status.has_passkeys;
    showPasskeyOption.value = status.has_passkeys;
    showPasswordField.value = true;
  } catch {
    errors.value = { email: t("auth.errors.generic") };
  } finally {
    loading.value = false;
  }
};

const handlePasswordSubmit = async () => {
  loading.value = true;
  errors.value = {};

  try {
    const result = await login({
      email: email.value,
      password: password.value,
    });

    // If 2FA is required, store the challenge token and redirect
    if (result.two_factor_required && result.challenge_token) {
      sessionStorage.setItem("2fa_challenge_token", result.challenge_token);
      navigateTo("/two-factor-challenge");
      return;
    }

    toast.success(t("auth.login.signedIn"));
    redirectAfterLogin(!!result.user?.onboarded);
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors) {
        const firstError = Object.values(fetchError.data.errors)[0];
        errors.value = {
          password: Array.isArray(firstError)
            ? firstError[0]
            : String(firstError),
        };
      } else {
        errors.value = {
          password:
            fetchError.data?.message || t("auth.errors.invalidCredentials"),
        };
      }
    } else {
      errors.value = { password: t("auth.errors.loginFailed") };
    }
  } finally {
    loading.value = false;
  }
};

const handleChangeEmail = () => {
  showPasswordField.value = false;
  password.value = "";
  userHasPasskeys.value = false;
  showPasskeyOption.value = false;
  errors.value = {};
};

const handlePasskeyLogin = async () => {
  passkeyLoading.value = true;
  errors.value = {};

  try {
    const { post, setTokens } = useApi();
    const { setUser, isInitialized } = useAuth();

    const optionsResponse = await post<{
      publicKey: PublicKeyCredentialRequestOptions;
    }>(
      "/auth/passkey/login/options",
      email.value ? { email: email.value } : {},
    );

    const publicKey = optionsResponse.publicKey;
    publicKey.challenge = base64UrlToArrayBuffer(
      publicKey.challenge as unknown as string,
    );

    if (publicKey.allowCredentials) {
      publicKey.allowCredentials = publicKey.allowCredentials.map((cred) => ({
        ...cred,
        id: base64UrlToArrayBuffer(cred.id as unknown as string),
      }));
    }

    const credential = (await navigator.credentials.get({
      publicKey,
    })) as PublicKeyCredential;
    if (!credential) throw new Error("Failed to get credential");

    const assertion = credential.response as AuthenticatorAssertionResponse;
    const authResponse = await post<{
      user: import("~/types").User;
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    }>("/auth/passkey/login/verify", {
      id: credential.id,
      rawId: arrayBufferToBase64Url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: arrayBufferToBase64Url(assertion.clientDataJSON),
        authenticatorData: arrayBufferToBase64Url(assertion.authenticatorData),
        signature: arrayBufferToBase64Url(assertion.signature),
        userHandle: assertion.userHandle
          ? arrayBufferToBase64Url(assertion.userHandle)
          : null,
      },
    });

    setTokens(authResponse.access_token, authResponse.refresh_token);
    await setUser(authResponse.user);
    isInitialized.value = true;

    toast.success(t("auth.login.signedIn"));
    redirectAfterLogin(authResponse.user.onboarded);
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === "NotAllowedError") {
      toast.error(t("auth.errors.passkeyCancelled"));
    } else if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(fetchError.data?.message || t("auth.errors.passkeyFailed"));
    } else {
      toast.error(t("auth.errors.passkeyFailedRetry"));
    }
  } finally {
    passkeyLoading.value = false;
  }
};

watch(showPasswordField, (show) => {
  if (show) {
    setTimeout(() => {
      passwordInputRef.value?.$el?.focus();
    }, 250);
  }
});
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      {{ t("auth.login.heading") }}
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{ t("auth.login.noAccount") }}
      <NuxtLink
        to="/register"
        class="font-medium text-primary hover:text-primary/90"
      >
        {{ t("auth.actions.signUp") }}
      </NuxtLink>
    </p>

    <ClientOnly>
      <AnimatePresence mode="wait">
        <!-- Email Form -->
        <Motion
          v-if="!showPasswordField"
          key="email-form"
          class="space-y-4"
          :initial="{ opacity: 0, x: -20 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: -20 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
        >
          <form class="space-y-4" @submit.prevent="handleEmailSubmit">
            <div class="space-y-2">
              <Label for="email">{{ t("auth.fields.email") }}</Label>
              <Input
                id="email"
                v-model="email"
                type="email"
                placeholder="m@example.com"
                autofocus
                required
              />
              <p v-if="errors.email" class="text-sm text-destructive">
                {{ errors.email }}
              </p>
            </div>
            <Button type="submit" class="w-full" :disabled="loading || !email">
              <Icon
                v-if="loading"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              {{
                loading
                  ? t("auth.actions.checking")
                  : t("auth.actions.continue")
              }}
            </Button>
          </form>

          <div class="relative my-2">
            <div class="absolute inset-0 flex items-center">
              <Separator class="w-full" />
            </div>
            <div class="relative flex justify-center text-xs uppercase">
              <span class="bg-background px-2 text-muted-foreground">{{
                t("auth.login.or")
              }}</span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            class="w-full"
            :disabled="passkeyLoading || loading"
            @click="handlePasskeyLogin"
          >
            <Icon
              v-if="passkeyLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <Icon v-else name="lucide:fingerprint" class="mr-2 h-4 w-4" />
            {{
              passkeyLoading
                ? t("auth.actions.authenticating")
                : t("auth.actions.signInPasskey")
            }}
          </Button>
        </Motion>

        <!-- Password Form -->
        <Motion
          v-else
          key="password-form"
          class="space-y-4"
          :initial="{ opacity: 0, x: 20 }"
          :animate="{ opacity: 1, x: 0 }"
          :exit="{ opacity: 0, x: 20 }"
          :transition="{ duration: 0.2, ease: 'easeOut' }"
        >
          <Motion
            class="flex items-center justify-between"
            :initial="{ opacity: 0, y: -10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.1 }"
          >
            <div class="flex-1">
              <p class="text-sm text-muted-foreground">
                {{ t("auth.login.signingInAs") }}
              </p>
              <p class="font-medium">{{ email }}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              @click="handleChangeEmail"
            >
              {{ t("auth.actions.change") }}
            </Button>
          </Motion>

          <!-- Passkey Option -->
          <Motion
            v-if="showPasskeyOption && userHasPasskeys"
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.15 }"
          >
            <Button
              type="button"
              variant="outline"
              class="w-full"
              :disabled="passkeyLoading || loading"
              @click="handlePasskeyLogin"
            >
              <Icon
                v-if="passkeyLoading"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              <Icon v-else name="lucide:fingerprint" class="mr-2 h-4 w-4" />
              {{
                passkeyLoading
                  ? t("auth.actions.authenticating")
                  : t("auth.actions.signInPasskey")
              }}
            </Button>
            <div class="relative my-6">
              <div class="absolute inset-0 flex items-center">
                <Separator class="w-full" />
              </div>
              <div class="relative flex justify-center text-xs uppercase">
                <span class="bg-background px-2 text-muted-foreground">{{
                  t("auth.login.orPassword")
                }}</span>
              </div>
            </div>
          </Motion>

          <Motion
            :initial="{ opacity: 0, y: 10 }"
            :animate="{ opacity: 1, y: 0 }"
            :transition="{ duration: 0.2, delay: 0.2 }"
          >
            <form class="space-y-4" @submit.prevent="handlePasswordSubmit">
              <div class="space-y-2">
                <Label for="password">{{ t("auth.fields.password") }}</Label>
                <Input
                  id="password"
                  ref="passwordInputRef"
                  v-model="password"
                  type="password"
                  required
                />
                <p v-if="errors.password" class="text-sm text-destructive">
                  {{ errors.password }}
                </p>
              </div>

              <div class="flex items-center space-x-2">
                <Checkbox id="remember" v-model="remember" />
                <Label for="remember" class="text-sm font-normal">{{
                  t("auth.login.rememberMe")
                }}</Label>
              </div>

              <Button
                type="submit"
                class="w-full"
                :disabled="loading || authLoading"
              >
                <Icon
                  v-if="loading || authLoading"
                  name="lucide:loader-2"
                  class="mr-2 h-4 w-4 animate-spin"
                />
                {{
                  loading || authLoading
                    ? t("auth.actions.signingIn")
                    : t("auth.actions.signIn")
                }}
              </Button>
            </form>
          </Motion>
        </Motion>
      </AnimatePresence>

      <!-- SSR Fallback -->
      <template #fallback>
        <form class="space-y-4" @submit.prevent="handleEmailSubmit">
          <div class="space-y-2">
            <Label for="email">{{ t("auth.fields.email") }}</Label>
            <Input
              id="email"
              v-model="email"
              type="email"
              placeholder="m@example.com"
              autofocus
              required
            />
            <p v-if="errors.email" class="text-sm text-destructive">
              {{ errors.email }}
            </p>
          </div>
          <Button type="submit" class="w-full" :disabled="loading || !email">
            <Icon
              v-if="loading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              loading ? t("auth.actions.checking") : t("auth.actions.continue")
            }}
          </Button>
        </form>
      </template>
    </ClientOnly>

    <p class="mt-6 text-sm text-muted-foreground">
      {{ t("auth.login.forgotPassword") }}
      <NuxtLink
        to="/forgot-password"
        class="font-medium text-primary hover:text-primary/90"
      >
        {{ t("auth.actions.resetPassword") }}
      </NuxtLink>
    </p>
  </div>
</template>
