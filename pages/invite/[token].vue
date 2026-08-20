<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { User } from "~/types";

definePageMeta({
  layout: "guest",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.invitation.pageTitle"),
}));

const route = useRoute();
const { setTokens } = useApi();
const { setUser } = useAuth();

const token = computed(() => route.params.token as string);

const email = ref("");
const teamName = ref("");
const teamId = ref("");
const userExists = ref(false);
const name = ref("");
const password = ref("");
const passwordConfirmation = ref("");
const errors = ref<Record<string, string>>({});
const loading = ref(false);
const invitationLoading = ref(true);

onMounted(async () => {
  try {
    const response = await $api<{
      data: {
        email: string;
        team_id: string;
        team_name: string;
        user_exists: boolean;
      };
    }>(`/auth/invitations/${token.value}`);
    email.value = response.data.email;
    teamId.value = response.data.team_id;
    teamName.value = response.data.team_name;
    userExists.value = response.data.user_exists;
  } catch {
    toast.error(t("auth.errors.invalidInvitation"));
    navigateTo("/login");
  } finally {
    invitationLoading.value = false;
  }
});

const handleSubmit = async () => {
  loading.value = true;
  errors.value = {};

  try {
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
    await setUser(response.data.user);

    toast.success(
      userExists.value
        ? t("auth.invitation.joined", {
            team: teamName.value || t("auth.invitation.defaultTeam"),
          })
        : t("auth.register.created"),
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
          password: fetchError.data?.message || t("auth.errors.genericShort"),
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
        {{
          userExists
            ? t("auth.invitation.joinHeading")
            : t("auth.invitation.completeHeading")
        }}
      </h3>
      <p class="mb-8 text-sm text-muted-foreground">
        {{
          t(
            userExists
              ? "auth.invitation.existingDescription"
              : "auth.invitation.newDescription",
            { team: teamName || t("auth.invitation.defaultTeam") },
          )
        }}
      </p>
      <p class="-mt-6 mb-8 text-xs text-muted-foreground">
        {{ t("auth.invitation.teamCode", { code: teamId.slice(-6) }) }}
      </p>

      <form class="space-y-4" @submit.prevent="handleSubmit">
        <div class="space-y-2">
          <Label for="email">{{ t("auth.fields.email") }}</Label>
          <Input id="email" v-model="email" type="email" disabled />
        </div>

        <div v-if="!userExists" class="space-y-2">
          <Label for="name">{{ t("auth.fields.fullName") }}</Label>
          <Input
            id="name"
            v-model="name"
            type="text"
            :placeholder="t('auth.invitation.fullNamePlaceholder')"
            required
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password">{{ t("auth.fields.password") }}</Label>
          <Input
            id="password"
            v-model="password"
            type="password"
            :placeholder="
              userExists
                ? t('auth.invitation.existingPasswordPlaceholder')
                : t('auth.invitation.newPasswordPlaceholder')
            "
            :autocomplete="userExists ? 'current-password' : 'new-password'"
            required
          />
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <div v-if="!userExists" class="space-y-2">
          <Label for="password_confirmation">{{
            t("auth.fields.confirmPassword")
          }}</Label>
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            type="password"
            :placeholder="t('auth.invitation.confirmPasswordPlaceholder')"
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
            {{
              userExists
                ? t("auth.actions.joining")
                : t("auth.actions.creatingAccount")
            }}
          </template>
          <template v-else>
            {{
              userExists
                ? t("auth.actions.joinTeam")
                : t("auth.actions.completeRegistration")
            }}
          </template>
        </Button>
      </form>
    </div>
  </div>
</template>
