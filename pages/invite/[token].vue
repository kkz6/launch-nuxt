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
const teamName = ref("");
// Whether the invited email already has an account. When true the page
// asks for the existing password to join the team instead of registering
// a fresh account (#71).
const userExists = ref(false);
const name = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const errors = ref<Record<string, string>>({});
const loading = ref(false);
const invitationLoading = ref(true);

// Fetch invitation details
onMounted(async () => {
  try {
    const response = await $api<{
      data: { email: string; team_name: string; user_exists: boolean };
    }>(`/auth/invitations/${token.value}`);
    email.value = response.data.email;
    teamName.value = response.data.team_name;
    userExists.value = response.data.user_exists;
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
    // Existing accounts join with just their password; new invitees
    // register with name + password + confirmation.
    const body: Record<string, string> = {
      invitation_token: token.value,
      password: password.value,
    };
    if (!userExists.value) {
      body.name = name.value;
      body.password_confirmation = passwordConfirmation.value;
    }

    const response = await $api<{
      data: {
        access_token: string;
        refresh_token: string;
        user: User;
      };
    }>("/auth/invitations/accept", {
      method: "POST",
      body,
    });

    setTokens(response.data.access_token, response.data.refresh_token);
    setUser(response.data.user);

    toast.success(
      userExists.value
        ? `You've joined ${teamName.value || "the team"}`
        : "Account created successfully",
    );
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
          password: fetchError.data?.message || "An error occurred",
        };
      }
    } else {
      errors.value = { password: "An error occurred. Please try again." };
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
        <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
      </div>

      <h3 class="mb-2 text-lg font-semibold text-foreground">
        {{ userExists ? "Join the team" : "Complete Your Invitation" }}
      </h3>
      <p class="mb-8 text-sm text-muted-foreground">
        <template v-if="userExists">
          You already have an account. Enter your password to join
          <span class="font-medium text-foreground">{{
            teamName || "the team"
          }}</span>.
        </template>
        <template v-else>
          You've been invited to join
          <span class="font-medium text-foreground">{{
            teamName || "the team"
          }}</span>. Please complete your account setup.
        </template>
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input id="email" v-model="email" type="email" disabled />
        </div>

        <div v-if="!userExists" class="space-y-2">
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
            :placeholder="
              userExists ? 'Enter your password' : 'Choose a secure password'
            "
            :autocomplete="userExists ? 'current-password' : 'new-password'"
            required
          />
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <div v-if="!userExists" class="space-y-2">
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
          <template v-if="loading">
            {{ userExists ? "Joining..." : "Creating Account..." }}
          </template>
          <template v-else>
            {{ userExists ? "Join Team" : "Complete Registration" }}
          </template>
        </Button>
      </form>
    </div>
  </div>
</template>
