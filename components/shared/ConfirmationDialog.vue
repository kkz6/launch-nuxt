<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '~/components/ui/alert-dialog'

interface ConfirmationOptions {
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  destructive?: boolean
}

const isOpen = ref(false)
const options = ref<ConfirmationOptions>({
  title: '',
  description: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
})

let resolvePromise: ((value: { ok: boolean }) => void) | null = null

const show = (opts: ConfirmationOptions): Promise<{ ok: boolean }> => {
  options.value = { ...options.value, ...opts }
  isOpen.value = true
  return new Promise((resolve) => {
    resolvePromise = resolve
  })
}

const handleConfirm = () => {
  isOpen.value = false
  resolvePromise?.({ ok: true })
}

const handleCancel = () => {
  isOpen.value = false
  resolvePromise?.({ ok: false })
}

defineExpose({ show })
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{ options.description }}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel @click="handleCancel">
          {{ options.cancelText }}
        </AlertDialogCancel>
        <AlertDialogAction
          :class="{ 'bg-destructive text-destructive-foreground hover:bg-destructive/90': options.destructive }"
          @click="handleConfirm"
        >
          {{ options.confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
