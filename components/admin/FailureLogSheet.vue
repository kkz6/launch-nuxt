<script setup lang="ts">
import { computed, ref, watch } from "vue";
import stripAnsi from "strip-ansi";
import { toast } from "vue-sonner";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";

interface FailureRow {
  kind?: string;
  title?: string;
  when?: string;
  error?: string;
  detail?: string;
}

const props = defineProps<{
  open: boolean;
  failure: FailureRow | null;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (value: boolean) => emit("update:open", value),
});

// The captured task output carries ANSI colour codes; strip them so the log
// reads cleanly in the viewer.
const cleanDetail = computed(() =>
  stripAnsi(props.failure?.detail ?? "").trim(),
);

const copied = ref(false);

async function copyLog(): Promise<void> {
  try {
    await navigator.clipboard.writeText(cleanDetail.value);
    copied.value = true;
    toast.success("Log copied to clipboard");
  } catch {
    toast.error("Could not copy log");
  }
}

watch(
  () => props.open,
  (open) => {
    if (!open) {
      copied.value = false;
    }
  },
);
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      class="!inset-y-auto !top-16 !bottom-4 !right-3 !h-auto w-full rounded-lg border sm:max-w-5xl flex flex-col"
    >
      <SheetHeader>
        <SheetTitle class="flex items-center gap-2">
          <Badge v-if="failure?.kind" variant="secondary">{{
            failure.kind
          }}</Badge>
          <span class="truncate">{{ failure?.title || "Failure log" }}</span>
        </SheetTitle>
        <SheetDescription>
          <span v-if="failure?.error" class="font-medium text-destructive">{{
            failure.error
          }}</span>
          <span v-if="failure?.when" class="text-muted-foreground">
            · {{ failure.when }}</span
          >
        </SheetDescription>
      </SheetHeader>

      <div class="mt-4 flex items-center justify-end">
        <Button
          variant="outline"
          size="sm"
          :disabled="!cleanDetail"
          @click="copyLog"
        >
          <Icon
            :name="copied ? 'lucide:check' : 'lucide:copy'"
            class="mr-2 h-4 w-4"
          />
          {{ copied ? "Copied" : "Copy log" }}
        </Button>
      </div>

      <div
        class="mt-3 flex-1 min-h-0 overflow-auto rounded-md border bg-muted/30"
      >
        <pre
          v-if="cleanDetail"
          class="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed"
          >{{ cleanDetail }}</pre
        >
        <p v-else class="p-4 text-sm text-muted-foreground">
          No log output was captured for this failure.
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>
