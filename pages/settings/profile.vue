<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({
  title: "Profile Settings",
});

const { user, setUser } = useAuth();
const isLoading = ref(false);
const isPasswordLoading = ref(false);

// Profile form
const profileSchema = toTypedSchema(
  z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Please enter a valid email address"),
  })
);

const {
  handleSubmit: handleProfileSubmit,
  errors: profileErrors,
  defineField: defineProfileField,
  resetForm: resetProfileForm,
} = useForm({
  validationSchema: profileSchema,
  initialValues: {
    name: user.value?.name || "",
    email: user.value?.email || "",
  },
});

const [name, nameAttrs] = defineProfileField("name");
const [email, emailAttrs] = defineProfileField("email");

// Password form
const passwordSchema = toTypedSchema(
  z
    .object({
      current_password: z.string().min(1, "Current password is required"),
      password: z.string().min(8, "Password must be at least 8 characters"),
      password_confirmation: z.string().min(1, "Please confirm your password"),
    })
    .refine((data) => data.password === data.password_confirmation, {
      message: "Passwords don't match",
      path: ["password_confirmation"],
    })
);

const {
  handleSubmit: handlePasswordSubmit,
  errors: passwordErrors,
  defineField: definePasswordField,
  resetForm: resetPasswordForm,
} = useForm({
  validationSchema: passwordSchema,
  initialValues: {
    current_password: "",
    password: "",
    password_confirmation: "",
  },
});

const [currentPassword, currentPasswordAttrs] =
  definePasswordField("current_password");
const [password, passwordAttrs] = definePasswordField("password");
const [passwordConfirmation, passwordConfirmationAttrs] = definePasswordField(
  "password_confirmation"
);

// Watch for user changes and reset form
watch(
  user,
  (newUser) => {
    if (newUser) {
      resetProfileForm({
        values: {
          name: newUser.name,
          email: newUser.email,
        },
      });
    }
  },
  { immediate: true }
);

const onProfileSubmit = handleProfileSubmit(async (values) => {
  isLoading.value = true;
  try {
    const response = await $api<{ data: { user: import("~/types").User } }>(
      "/user/profile",
      {
        method: "PUT",
        body: values,
      }
    );
    setUser(response.data.user);
    toast.success("Profile updated successfully");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(fetchError.data?.message || "Failed to update profile");
    } else {
      toast.error("An error occurred");
    }
  } finally {
    isLoading.value = false;
  }
});

const onPasswordSubmit = handlePasswordSubmit(async (values) => {
  isPasswordLoading.value = true;
  try {
    await $api("/user/password", {
      method: "PUT",
      body: values,
    });
    toast.success("Password updated successfully");
    resetPasswordForm();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(fetchError.data?.message || "Failed to update password");
    } else {
      toast.error("An error occurred");
    }
  } finally {
    isPasswordLoading.value = false;
  }
});
</script>

<template>
  <div class="flex w-full flex-col gap-6">
    <!-- Profile Information -->
    <SettingsCard
      title="Profile Information"
      description="Update your account's profile information and email address."
    >
      <form class="space-y-4" @submit.prevent="onProfileSubmit">
        <div class="space-y-2">
          <Label for="name">Name</Label>
          <Input
            id="name"
            v-model="name"
            v-bind="nameAttrs"
            type="text"
            class="max-w-md"
          />
          <p v-if="profileErrors.name" class="text-sm text-destructive">
            {{ profileErrors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="email">Email</Label>
          <Input
            id="email"
            v-model="email"
            v-bind="emailAttrs"
            type="email"
            class="max-w-md"
          />
          <p v-if="profileErrors.email" class="text-sm text-destructive">
            {{ profileErrors.email }}
          </p>
        </div>
      </form>

      <template #footer>
        <Button :disabled="isLoading" @click="onProfileSubmit">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save
        </Button>
      </template>
    </SettingsCard>

    <!-- Update Password -->
    <SettingsCard
      title="Update Password"
      description="Ensure your account is using a long, random password to stay secure."
    >
      <form class="space-y-4" @submit.prevent="onPasswordSubmit">
        <div class="space-y-2">
          <Label for="current_password">Current Password</Label>
          <Input
            id="current_password"
            v-model="currentPassword"
            v-bind="currentPasswordAttrs"
            type="password"
            class="max-w-md"
          />
          <p
            v-if="passwordErrors.current_password"
            class="text-sm text-destructive"
          >
            {{ passwordErrors.current_password }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password">New Password</Label>
          <Input
            id="password"
            v-model="password"
            v-bind="passwordAttrs"
            type="password"
            class="max-w-md"
          />
          <p v-if="passwordErrors.password" class="text-sm text-destructive">
            {{ passwordErrors.password }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="password_confirmation">Confirm Password</Label>
          <Input
            id="password_confirmation"
            v-model="passwordConfirmation"
            v-bind="passwordConfirmationAttrs"
            type="password"
            class="max-w-md"
          />
          <p
            v-if="passwordErrors.password_confirmation"
            class="text-sm text-destructive"
          >
            {{ passwordErrors.password_confirmation }}
          </p>
        </div>
      </form>

      <template #footer>
        <Button :disabled="isPasswordLoading" @click="onPasswordSubmit">
          <Icon
            v-if="isPasswordLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save
        </Button>
      </template>
    </SettingsCard>
  </div>
</template>
