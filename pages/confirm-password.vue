<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

definePageMeta({
  layout: "guest",
  middleware: "auth",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.confirmPassword.pageTitle"),
}));

const password = ref("");
const errors = ref<Record<string, string>>({});
const loading = ref(false);

const handleSubmit = async () => {
  loading.value = true;
  errors.value = {};

  try {
    await $api("/auth/confirm-password", {
      method: "POST",
      body: { password: password.value },
    });

    toast.success(t("auth.confirmPassword.success"));
    // Redirect back to the intended page
    navigateTo("/dashboard");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors?.password) {
        errors.value = { password: fetchError.data.errors.password[0] };
      } else {
        errors.value = {
          password:
            fetchError.data?.message || t("auth.errors.invalidPassword"),
        };
      }
    } else {
      errors.value = { password: t("auth.errors.generic") };
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      {{ t("auth.confirmPassword.heading") }}
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{ t("auth.confirmPassword.description") }}
    </p>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div class="space-y-2">
        <Label for="password">{{ t("auth.fields.password") }}</Label>
        <Input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          autofocus
          required
        />
        <p v-if="errors.password" class="text-sm text-destructive">
          {{ errors.password }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="loading">
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{ loading ? t("auth.actions.confirming") : t("auth.actions.confirm") }}
      </Button>
    </form>
  </div>
</template>
