<script setup lang="ts">
import { computed, ref, watch } from "vue";
import stripAnsi from "strip-ansi";
import { toast } from "vue-sonner";
import { adminService } from "~/services/adminService";
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
  id?: string;
  // kind is the display badge ({value,variant}); kind_raw is the unmapped
  // string ("provision" | "site_installation" | "service_installation") used
  // for the log endpoint query.
  kind?: unknown;
  kind_raw?: string;
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

// The kind cell arrives as a mapped badge ({value,variant}); fall back to a
// humanised kind_raw for the header label.
const kindLabel = computed<string>(() => {
  const k = props.failure?.kind;
  if (k && typeof k === "object" && "value" in k) {
    return String((k as { value?: unknown }).value ?? "");
  }
  const raw = props.failure?.kind_raw;
  return raw ? raw.replace(/_/g, " ") : "";
});

// The table only carries a truncated detail; fetch the full output lazily when
// the sheet opens (falling back to the truncated detail while it loads / if the
// fetch fails).
const fullLog = ref<string | null>(null);
const loading = ref(false);

const rawLog = computed(() => fullLog.value ?? props.failure?.detail ?? "");
// Captured task output carries ANSI colour codes; strip them for readability.
const cleanLog = computed(() => stripAnsi(rawLog.value).trim());

async function loadFullLog(): Promise<void> {
  const f = props.failure;
  if (!f?.id || !f.kind_raw) return;
  loading.value = true;
  try {
    const res = await adminService.failureLog(f.id, f.kind_raw);
    fullLog.value = res.data.log;
  } catch {
    // Keep the truncated detail as a fallback; no toast — it's non-critical.
  } finally {
    loading.value = false;
  }
}

const copied = ref(false);

async function copyLog(): Promise<void> {
  try {
    await navigator.clipboard.writeText(cleanLog.value);
    copied.value = true;
    toast.success("Log copied to clipboard");
  } catch {
    toast.error("Could not copy log");
  }
}

watch(
  () => props.open,
  (open) => {
    if (open) {
      fullLog.value = null;
      copied.value = false;
      loadFullLog();
    }
  },
);
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent
      class="!inset-y-auto !right-3 !top-16 !bottom-4 flex !h-auto w-full flex-col rounded-lg border sm:max-w-5xl"
    >
      <SheetHeader class="flex-row items-start justify-between gap-4 space-y-0">
        <div class="min-w-0 space-y-1">
          <SheetTitle class="flex items-center gap-2">
            <Badge v-if="kindLabel" variant="secondary" class="capitalize">
              {{ kindLabel }}
            </Badge>
            <span class="truncate">{{ failure?.title || "Failure log" }}</span>
          </SheetTitle>
          <SheetDescription
            class="flex flex-wrap items-center gap-x-2 gap-y-0.5"
          >
            <span v-if="failure?.error" class="font-medium text-destructive">
              {{ failure.error }}
            </span>
            <span v-if="failure?.error && failure?.when">·</span>
            <SharedDateTooltip
              v-if="failure?.when"
              :date="failure.when"
              class-name="text-muted-foreground"
            />
          </SheetDescription>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="shrink-0"
          :disabled="!cleanLog"
          @click="copyLog"
        >
          <Icon
            :name="copied ? 'lucide:check' : 'lucide:copy'"
            class="mr-1.5 h-4 w-4"
          />
          {{ copied ? "Copied" : "Copy log" }}
        </Button>
      </SheetHeader>

      <div
        class="relative mt-3 min-h-0 flex-1 overflow-auto rounded-md border bg-muted/30"
      >
        <div
          v-if="loading"
          class="absolute right-2 top-2 flex items-center gap-1.5 rounded bg-background/80 px-2 py-1 text-xs text-muted-foreground"
        >
          <Icon name="lucide:loader-2" class="h-3.5 w-3.5 animate-spin" />
          Loading full log…
        </div>
        <pre
          v-if="cleanLog"
          class="whitespace-pre-wrap break-words p-4 font-mono text-xs leading-relaxed"
          >{{ cleanLog }}</pre
        >
        <p v-else class="p-4 text-sm text-muted-foreground">
          No log output was captured for this failure.
        </p>
      </div>
    </SheetContent>
  </Sheet>
</template>
