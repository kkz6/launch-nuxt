<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { User } from "~/types";

definePageMeta({
  layout: "guest",
  middleware: "guest",
});

useHead({
  title: "Complete Your Invitation",
});

const route = useRoute();
const { setTokens } = useApi();
const { setUser } = useAuth();

const token = computed(() => route.params.token as string);

const email = ref("");
const name = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const errors = ref<Record<string, string>>({});
const loading = ref(false);
const invitationLoading = ref(true);

// Fetch invitation details
onMounted(async () => {
  try {
    const response = await $api<{ email: string }>(
      `/auth/invitations/${token.value}`
    );
    email.value = response.email;
  } catch {
    toast.error("Invalid or expired invitation");
    navigateTo("/login");
  } finally {
    invitationLoading.value = false;
  }
});

const handleSubmit = async () => {
  loading.value = true;
  errors.value = {};

  try {
    const response = await $api<{
      data: {
        access_token: string;
        refresh_token: string;
        user: User;
      };
    }>("/auth/invitations/accept", {
      method: "POST",
      body: {
        invitation_token: token.value,
        name: name.value,
        password: password.value,
        password_confirmation: passwordConfirmation.value,
      },
    });

    setTokens(response.data.access_token, response.data.refresh_token);
    setUser(response.data.user);

    toast.success("Account created successfully");
    navigateTo("/dashboard");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors) {
        const errs: Record<string, string> = {};
        Object.entries(fetchError.data.errors).forEach(([key, value]) => {
          errs[key] = Array.isArray(value) ? value[0] : String(value);
        });
        errors.value = errs;
      } else {
        errors.value = {
          name: fetchError.data?.message || "An error occurred",
        };
      }
    } else {
      errors.value = { name: "An error occurred. Please try again." };
    }
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="flex min-h-screen items-center justify-center">
    <div v-if="invitationLoading" class="flex items-center justify-center">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div v-else class="w-full max-w-md px-6">
      <div class="mb-8 flex items-center">
        <NuxtLink to="/" class="text-2xl font-bold">Launch</NuxtLink>
      </div>

      <h3 class="mb-2 text-lg font-semibold text-foreground">
        Complete Your Invitation
      </h3>
      <p class="mb-8 text-sm text-muted-foreground">
        You've been invited to join. Please complete your account setup.
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" disabled />
        </div>

        <div class="space-y-2">
          <Label for="name">Full Name</Label>
          <Input
            id="name"
            v-model="name"
            type="text"
            placeholder="Enter your full name"
            required
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password">Password</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            placeholder="Choose a secure password"
            autocomplete="new-password"
            required
          />
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password_confirmation">Confirm Password</Label>
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            type="password"
            placeholder="Confirm your password"
            autocomplete="new-password"
            required
          />
          <p
            v-if="errors.password_confirmation"
            class="text-sm text-destructive"
          >
            {{ errors.password_confirmation }}
          </p>
        </div>

        <Button type="submit" class="w-full" :disabled="loading">
          <Icon
            v-if="loading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{ loading ? "Creating Account..." : "Complete Registration" }}
        </Button>
      </form>
    </div>
  </div>
</template>
