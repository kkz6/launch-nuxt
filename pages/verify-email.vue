<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Alert, AlertDescription } from "~/components/ui/alert";
import { authService } from "~/services/authService";

definePageMeta({
  layout: "guest",
  middleware: "auth",
});

useHead({
  title: "Email Verification",
});

const { logout } = useAuth();

const loading = ref(false);
const status = ref("");

const handleResend = async () => {
  loading.value = true;
  status.value = "";

  try {
    await authService.resendVerification();
    status.value = "verification-link-sent";
    toast.success("Verification link sent!");
  } catch {
    toast.error("Failed to send verification link");
  } finally {
    loading.value = false;
  }
};

const handleLogout = async () => {
  await logout();
};
</script>

<template>
  <div>
    <Alert v-if="status === 'verification-link-sent'" class="mb-6">
      <Icon name="lucide:info" class="h-4 w-4" />
      <AlertDescription>
        A new verification link has been sent to the email address you
        provided during registration.
      </AlertDescription>
    </Alert>

    <div class="mb-8 flex items-center">
      <NuxtLink to="/" class="text-2xl font-bold">launchctl</NuxtLink>
    </div>

    <h3 class="mb-2 text-lg font-semibold text-foreground">
      Email Verification
    </h3>
    <p class="mb-8 text-sm text-muted-foreground">
      Thanks for signing up! Before getting started, could you verify your
      email address by clicking on the link we just emailed to you? If you
      didn't receive the email, we will gladly send you another.
    </p>

    <div class="space-y-4">
      <Button
        type="button"
        class="w-full"
        :disabled="loading"
        @click="handleResend"
      >
        <Icon
          v-if="loading"
          name="lucide:loader-2"
          class="mr-2 h-4 w-4 animate-spin"
        />
        {{ loading ? 'Sending...' : 'Resend Verification Email' }}
      </Button>

      <Button
        type="button"
        variant="outline"
        class="w-full"
        @click="handleLogout"
      >
        Log Out
      </Button>
    </div>
  </div>
</template>
