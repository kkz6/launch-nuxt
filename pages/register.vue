<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

definePageMeta({
  layout: "guest",
  middleware: "guest",
});

const { t } = useI18n();

useHead(() => ({
  title: t("auth.register.pageTitle"),
}));

const { register, isLoading } = useAuth();

const formSchema = computed(() =>
  toTypedSchema(
    z
      .object({
        name: z.string().min(2, t("auth.validation.nameMin")),
        email: z.string().email(t("auth.validation.email")),
        password: z.string().min(8, t("auth.validation.passwordMin")),
        password_confirmation: z.string(),
      })
      .refine((data) => data.password === data.password_confirmation, {
        message: t("auth.validation.passwordMismatch"),
        path: ["password_confirmation"],
      }),
  ),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
  },
});

const [name, nameAttrs] = defineField("name");
const [email, emailAttrs] = defineField("email");
const [password, passwordAttrs] = defineField("password");
const [passwordConfirmation, passwordConfirmationAttrs] = defineField(
  "password_confirmation",
);

const onSubmit = handleSubmit(async (values) => {
  try {
    await register(values);
    toast.success(t("auth.register.created"));
    navigateTo("/dashboard");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { message?: string; errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors) {
        Object.values(fetchError.data.errors).forEach((messages) => {
          messages.forEach((msg) => toast.error(msg));
        });
      } else {
        toast.error(
          fetchError.data?.message || t("auth.errors.registrationFailed"),
        );
      }
    } else {
      toast.error(t("auth.errors.registrationError"));
    }
  }
});
</script>

<template>
  <div>
    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      {{ t("auth.register.heading") }}
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      {{ t("auth.register.hasAccount") }}
      <NuxtLink
        to="/login"
        class="font-medium text-primary hover:text-primary/90"
      >
        {{ t("auth.actions.signIn") }}
      </NuxtLink>
    </p>

    <form class="space-y-4" @submit="onSubmit">
      <div class="space-y-2">
        <Label for="name">{{ t("auth.fields.name") }}</Label>
        <Input
          id="name"
          v-model="name"
          v-bind="nameAttrs"
          type="text"
          :placeholder="t('auth.register.namePlaceholder')"
          autocomplete="name"
        />
        <p v-if="errors.name" class="text-sm text-destructive">
          {{ errors.name }}
        </p>
      </div>

      <div class="space-y-2">
        <Label for="email">{{ t("auth.fields.email") }}</Label>
        <Input
          id="email"
          v-model="email"
          v-bind="emailAttrs"
          type="email"
          placeholder="m@example.com"
          autocomplete="email"
        />
        <p v-if="errors.email" class="text-sm text-destructive">
          {{ errors.email }}
        </p>
      </div>

      <div class="space-y-2">
        <Label for="password">{{ t("auth.fields.password") }}</Label>
        <Input
          id="password"
          v-model="password"
          v-bind="passwordAttrs"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="errors.password" class="text-sm text-destructive">
          {{ errors.password }}
        </p>
      </div>

      <div class="space-y-2">
        <Label for="password_confirmation">{{
          t("auth.fields.confirmPassword")
        }}</Label>
        <Input
          id="password_confirmation"
          v-model="passwordConfirmation"
          v-bind="passwordConfirmationAttrs"
          type="password"
          autocomplete="new-password"
        />
        <p v-if="errors.password_confirmation" class="text-sm text-destructive">
          {{ errors.password_confirmation }}
        </p>
      </div>

      <Button type="submit" class="w-full" :disabled="isLoading">
        <Icon
          v-if="isLoading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{
          isLoading
            ? t("auth.actions.creatingAccount")
            : t("auth.actions.createAccount")
        }}
      </Button>
    </form>
  </div>
</template>
