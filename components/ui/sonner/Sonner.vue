<script lang="ts" setup>
import type { ToasterProps } from "vue-sonner"
import { reactiveOmit } from "@vueuse/core"
import { CheckIcon, InfoIcon, Loader2Icon, XIcon, AlertTriangleIcon, CircleAlertIcon } from "lucide-vue-next"
import { Toaster as Sonner } from "vue-sonner"

const props = defineProps<ToasterProps>()
const delegatedProps = reactiveOmit(props, "toastOptions")
</script>

<template>
  <Sonner
    class="toaster group font-sans"
    :toast-options="{
      classes: {
        toast: 'group toast group-[.toaster]:text-foreground group-[.toaster]:border group-[.toaster]:shadow-sm group-[.toaster]:rounded-lg',
        title: 'group-[.toast]:font-medium group-[.toast]:text-sm',
        description: 'group-[.toast]:text-muted-foreground group-[.toast]:text-sm',
        actionButton: 'group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-md group-[.toast]:text-sm group-[.toast]:font-medium',
        cancelButton: 'group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-md group-[.toast]:text-sm',
      },
    }"
    v-bind="delegatedProps"
  >
    <template #success-icon>
      <CheckIcon class="h-[18px] w-[18px] text-emerald-600 dark:text-emerald-400" :stroke-width="2.5" />
    </template>
    <template #info-icon>
      <InfoIcon class="h-[18px] w-[18px] text-blue-600 dark:text-blue-400" :stroke-width="2.5" />
    </template>
    <template #warning-icon>
      <AlertTriangleIcon class="h-[18px] w-[18px] text-amber-600 dark:text-amber-400" :stroke-width="2.5" />
    </template>
    <template #error-icon>
      <CircleAlertIcon class="h-[18px] w-[18px] text-destructive" :stroke-width="2" />
    </template>
    <template #loading-icon>
      <Loader2Icon class="h-[18px] w-[18px] animate-spin text-muted-foreground" />
    </template>
    <template #close-icon>
      <XIcon class="h-3.5 w-3.5" />
    </template>
  </Sonner>
</template>

<style>
/* Base toast styles */
[data-sonner-toast] {
  padding: 12px 38px 12px 14px !important;
  gap: 10px !important;
  overflow: hidden;
  border-color: hsl(var(--border)) !important;
  background: hsl(var(--background)) !important;
  position: relative;
}

/* Close button styling */
[data-sonner-toast] [data-close-button] {
  position: absolute !important;
  top: 50% !important;
  right: 10px !important;
  left: auto !important;
  bottom: auto !important;
  transform: translateY(-50%) !important;
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: hsl(var(--muted-foreground)) !important;
  opacity: 0.65;
  transition: opacity 150ms, color 150ms;
  padding: 4px !important;
  width: auto !important;
  height: auto !important;
  border-radius: 4px !important;
}

[data-sonner-toast] [data-close-button]:hover,
[data-sonner-toast] [data-close-button]:focus-visible {
  opacity: 1 !important;
  color: hsl(var(--foreground)) !important;
  background: hsl(var(--muted) / 0.8) !important;
}

[data-sonner-toast] [data-close-button]:focus-visible {
  outline: 2px solid hsl(var(--ring));
  outline-offset: 2px;
}

/* Toast content needs to be above the bg overlay */
[data-sonner-toast] > * {
  position: relative;
  z-index: 1;
}
</style>
