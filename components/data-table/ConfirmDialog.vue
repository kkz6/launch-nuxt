<script setup lang="ts">
// Confirms a row or bulk action via a proper shadcn modal dialog.
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import type { ActionDef } from "~/types/data-table";

defineProps<{
  action: ActionDef;
}>();

const emit = defineEmits<{
  confirm: [];
  cancel: [];
}>();
</script>

<template>
  <Dialog :open="true" @update:open="(v) => !v && emit('cancel')">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ action.confirm?.title ?? "Confirm" }}</DialogTitle>
        <DialogDescription v-if="action.confirm?.message">
          {{ action.confirm.message }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" @click="emit('cancel')">
          {{ action.confirm?.cancelLabel ?? "Cancel" }}
        </Button>
        <Button
          :variant="
            action.variant === 'destructive' ? 'destructive' : 'default'
          "
          @click="emit('confirm')"
        >
          {{ action.confirm?.confirmLabel ?? "Confirm" }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
