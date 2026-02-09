<script setup lang="ts">
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Alert, AlertDescription } from "~/components/ui/alert";

definePageMeta({
  layout: "guest",
  middleware: "guest",
});

useHead({
  title: "Forgot Password",
});

const { forgotPassword, isLoading } = useAuth();

const email = ref("");
const errors = ref<Record<string, string>>({});
const status = ref("");

const handleSubmit = async () => {
  errors.value = {};
  status.value = "";

  try {
    await forgotPassword(email.value);
    status.value = "We have emailed your password reset link!";
    email.value = "";
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors?.email) {
        errors.value = { email: fetchError.data.errors.email[0] };
      } else {
        errors.value = {
          email: fetchError.data?.message || "An error occurred",
        };
      }
    } else {
      errors.value = { email: "An error occurred. Please try again." };
    }
  }
};
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <Alert v-if="status" class="mb-6 flex items-start gap-3">
      <Icon name="lucide:circle-check" class="h-4 w-4 mt-0.5 shrink-0 text-green-600" />
      <AlertDescription>{{ status }}</AlertDescription>
    </Alert>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      Forgot your password?
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      No problem. Just let us know your email address and we will email you a
      password reset link that will allow you to choose a new one.
    </p>

    <form class="space-y-4" @submit.prevent="handleSubmit">
      <div class="space-y-2">
        <Label for="email">Email</Label>
        <Input
          id="email"
          v-model="email"
          type="email"
          placeholder="m@example.com"
          autocomplete="email"
          required
        />
        <p v-if="errors.email" class="text-sm text-destructive">
          {{ errors.email }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="isLoading">
        <Icon
          v-if="isLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{ isLoading ? 'Sending...' : 'Email Password Reset Link' }}
      </Button>
    </form>

    <p class="mt-6 text-sm text-muted-foreground">
      Remember your password?
      <NuxtLink
        to="/login"
        class="font-medium text-primary hover:text-primary/90"
      >
        Back to login
      </NuxtLink>
    </p>
  </div>
</template>
