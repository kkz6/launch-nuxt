<script setup lang="ts">
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '~/components/ui/collapsible'

const passkeysOpen = ref(true)
const twoFactorOpen = ref(false)
</script>

<template>
  <div class="space-y-4">
    <!-- Passkeys -->
    <Collapsible v-model:open="passkeysOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:fingerprint" class="size-4 text-muted-foreground" />
          <span class="font-medium">Passkeys</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': passkeysOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <SettingsPasskeys />
      </CollapsibleContent>
    </Collapsible>

    <!-- Two-Factor Authentication -->
    <Collapsible v-model:open="twoFactorOpen" class="rounded-lg border">
      <CollapsibleTrigger class="flex w-full items-center justify-between p-4 hover:bg-muted/50">
        <div class="flex items-center gap-2">
          <Icon name="lucide:shield-check" class="size-4 text-muted-foreground" />
          <span class="font-medium">Two-Factor Authentication</span>
        </div>
        <Icon
          name="lucide:chevron-down"
          class="size-4 text-muted-foreground transition-transform"
          :class="{ 'rotate-180': twoFactorOpen }"
        />
      </CollapsibleTrigger>
      <CollapsibleContent class="border-t px-4 pb-4 pt-4">
        <SettingsTwoFactor />
      </CollapsibleContent>
    </Collapsible>
  </div>
</template>
