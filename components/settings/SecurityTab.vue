<script setup lang="ts">
</script>

<template>
  <div class="divide-y">
    <!-- Passkeys Section -->
    <div class="px-6 pb-6">
      <h3 class="mb-1 text-base font-semibold">Passkeys</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        Use passkeys for passwordless authentication.
      </p>
      <SettingsPasskeys />
    </div>

    <!-- Two-Factor Authentication Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 text-base font-semibold">Two-Factor Authentication</h3>
      <p class="mb-4 text-sm text-muted-foreground">
        Add an extra layer of security to your account.
      </p>
      <SettingsTwoFactor />
    </div>
  </div>
</template>
