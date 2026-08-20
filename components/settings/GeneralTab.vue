<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

const { user, setUser, fetchUser } = useAuth();
const { t } = useI18n();

// Profile form state
const isLoading = ref(false);
const name = ref(user.value?.name || "");
const email = ref(user.value?.email || "");
const profileErrors = ref<{ name?: string; email?: string }>({});

// Password form state
const isPasswordLoading = ref(false);
const currentPassword = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const passwordErrors = ref<{
  current_password?: string;
  password?: string;
  password_confirmation?: string;
}>({});

watch(
  user,
  (newUser) => {
    if (newUser) {
      name.value = newUser.name;
      email.value = newUser.email;
    }
  },
  { immediate: true },
);

const validateProfile = (): boolean => {
  profileErrors.value = {};
  if (!name.value.trim() || name.value.length < 2) {
    profileErrors.value.name = t("settings.general.nameMin");
  }
  if (!email.value.trim() || !email.value.includes("@")) {
    profileErrors.value.email = t("settings.general.emailInvalid");
  }
  return Object.keys(profileErrors.value).length === 0;
};

const validatePassword = (): boolean => {
  passwordErrors.value = {};
  if (!currentPassword.value) {
    passwordErrors.value.current_password = t(
      "settings.general.currentPasswordRequired",
    );
  }
  if (!password.value || password.value.length < 8) {
    passwordErrors.value.password = t("settings.general.passwordMin");
  }
  if (password.value !== passwordConfirmation.value) {
    passwordErrors.value.password_confirmation = t(
      "settings.general.passwordMismatch",
    );
  }
  return Object.keys(passwordErrors.value).length === 0;
};

const onProfileSubmit = async () => {
  if (!validateProfile()) return;

  isLoading.value = true;
  try {
    const response = await $api<{ data: { user: import("~/types").User } }>(
      "/user/profile",
      {
        method: "PUT",
        body: { name: name.value, email: email.value },
      },
    );
    setUser(response.data.user);
    toast.success(t("settings.general.profileUpdated"));
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        profileErrors.value[field as keyof typeof profileErrors.value] =
          messages[0];
      }
    } else {
      toast.error(
        err.data?.message || t("settings.general.profileUpdateFailed"),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

const onPasswordSubmit = async () => {
  if (!validatePassword()) return;

  isPasswordLoading.value = true;
  try {
    await $api("/user/password", {
      method: "PUT",
      body: {
        current_password: currentPassword.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    });
    toast.success(t("settings.general.passwordUpdated"));
    currentPassword.value = "";
    password.value = "";
    passwordConfirmation.value = "";
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        passwordErrors.value[field as keyof typeof passwordErrors.value] =
          messages[0];
      }
    } else {
      toast.error(
        err.data?.message || t("settings.general.passwordUpdateFailed"),
      );
    }
  } finally {
    isPasswordLoading.value = false;
  }
};

// Onboarding reset
const isOnboardingLoading = ref(false);
const router = useRouter();
const { close: closeSettings } = useSettingsSheet();

const resetOnboarding = async () => {
  isOnboardingLoading.value = true;
  try {
    await $api("/auth/reset-onboarding", { method: "POST" });
    await fetchUser();
    toast.success(t("settings.general.onboardingReset"));
    closeSettings();
    router.push("/onboarding");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(
      err.data?.message || t("settings.general.onboardingResetFailed"),
    );
  } finally {
    isOnboardingLoading.value = false;
  }
};
</script>

<template>
  <div class="divide-y">
    <!-- Profile Section -->
    <div class="px-6 pb-6">
      <form class="space-y-4" @submit.prevent="onProfileSubmit">
        <div class="space-y-1.5">
          <Label for="name" class="text-xs font-medium text-muted-foreground">{{
            t("settings.general.name")
          }}</Label>
          <Input
            id="name"
            v-model="name"
            type="text"
            :class="{ 'border-destructive': profileErrors.name }"
          />
          <p v-if="profileErrors.name" class="text-sm text-destructive">
            {{ profileErrors.name }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label
            for="email"
            class="text-xs font-medium text-muted-foreground"
            >{{ t("settings.general.email") }}</Label
          >
          <Input
            id="email"
            v-model="email"
            type="email"
            :class="{ 'border-destructive': profileErrors.email }"
          />
          <p v-if="profileErrors.email" class="text-sm text-destructive">
            {{ profileErrors.email }}
          </p>
        </div>

        <Button :disabled="isLoading" type="submit" size="sm">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          {{ t("settings.general.saveChanges") }}
        </Button>
      </form>
    </div>

    <!-- Password Section -->
    <div class="px-6 py-6">
      <h3 class="mb-4 text-base font-semibold">
        {{ t("settings.general.passwordTitle") }}
      </h3>
      <form class="space-y-4" @submit.prevent="onPasswordSubmit">
        <div class="space-y-1.5">
          <Label
            for="current_password"
            class="text-xs font-medium text-muted-foreground"
            >{{ t("settings.general.currentPassword") }}</Label
          >
          <Input
            id="current_password"
            v-model="currentPassword"
            type="password"
            class="sm:w-72"
            :class="{ 'border-destructive': passwordErrors.current_password }"
          />
          <p
            v-if="passwordErrors.current_password"
            class="text-sm text-destructive"
          >
            {{ passwordErrors.current_password }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label
            for="password"
            class="text-xs font-medium text-muted-foreground"
            >{{ t("settings.general.newPassword") }}</Label
          >
          <Input
            id="password"
            v-model="password"
            type="password"
            class="sm:w-72"
            :class="{ 'border-destructive': passwordErrors.password }"
          />
          <p v-if="passwordErrors.password" class="text-sm text-destructive">
            {{ passwordErrors.password }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label
            for="password_confirmation"
            class="text-xs font-medium text-muted-foreground"
            >{{ t("settings.general.confirmPassword") }}</Label
          >
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            type="password"
            class="sm:w-72"
            :class="{
              'border-destructive': passwordErrors.password_confirmation,
            }"
          />
          <p
            v-if="passwordErrors.password_confirmation"
            class="text-sm text-destructive"
          >
            {{ passwordErrors.password_confirmation }}
          </p>
        </div>

        <Button :disabled="isPasswordLoading" type="submit" size="sm">
          <Icon
            v-if="isPasswordLoading"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          {{ t("settings.general.updatePassword") }}
        </Button>
      </form>
    </div>

    <!-- Onboarding Section -->
    <div v-if="user?.onboarded" class="px-6 py-6">
      <h3 class="mb-2 text-base font-semibold">
        {{ t("settings.general.onboardingTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.general.onboardingDescription") }}
      </p>
      <Button
        variant="outline"
        size="sm"
        :disabled="isOnboardingLoading"
        @click="resetOnboarding"
      >
        <Icon
          v-if="isOnboardingLoading"
          name="lucide:loader-2"
          class="mr-2 block size-4 animate-spin"
        />
        <Icon v-else name="lucide:refresh-cw" class="mr-2 size-4" />
        {{ t("settings.general.resetOnboarding") }}
      </Button>
    </div>
  </div>
</template>
