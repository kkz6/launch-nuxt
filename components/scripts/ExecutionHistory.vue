<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Badge } from "~/components/ui/badge";
import { ScrollArea } from "~/components/ui/scroll-area";

interface Execution {
  id: number;
  script_id: string;
  server_id: string;
  server_name: string;
  batch_id: string;
  run_as: "root" | "local";
  status: "pending" | "running" | "finished" | "failed";
  exit_code: number | null;
  output: string;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
}

interface Script {
  id: string;
  name: string;
}

interface Props {
  script: Script;
}

const props = defineProps<Props>();
const open = defineModel<boolean>("open", { default: false });
const { t } = useI18n();

const executions = ref<Execution[]>([]);
const isLoading = ref(true);
const selectedExecution = ref<Execution | null>(null);
const showOutput = ref(false);

const fetchExecutions = async () => {
  isLoading.value = true;
  try {
    const response = await $api<{ data: Execution[] }>(
      `/scripts/${props.script.id}/executions`,
    );
    executions.value = response.data;
  } catch {
    toast.error(t("operations.scripts.history.loadError"));
  } finally {
    isLoading.value = false;
  }
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "pending":
      return {
        variant: "secondary" as const,
        label: t("operations.scripts.common.status.pending"),
      };
    case "running":
      return {
        variant: "default" as const,
        label: t("operations.scripts.common.status.running"),
      };
    case "finished":
      return {
        variant: "success" as const,
        label: t("operations.scripts.common.status.finished"),
      };
    case "failed":
      return {
        variant: "destructive" as const,
        label: t("operations.scripts.common.status.failed"),
      };
    default:
      return { variant: "secondary" as const, label: status };
  }
};

const viewOutput = (execution: Execution) => {
  selectedExecution.value = execution;
  showOutput.value = true;
};

// Parse ANSI codes for colored output
const parseAnsi = (text: string) => {
  const ansiColors: Record<string, string> = {
    "30": "color: #000",
    "31": "color: #e74c3c",
    "32": "color: #2ecc71",
    "33": "color: #f39c12",
    "34": "color: #3498db",
    "35": "color: #9b59b6",
    "36": "color: #1abc9c",
    "37": "color: #ecf0f1",
    "90": "color: #7f8c8d",
    "91": "color: #e74c3c",
    "92": "color: #2ecc71",
    "93": "color: #f1c40f",
    "94": "color: #3498db",
    "95": "color: #9b59b6",
    "96": "color: #1abc9c",
    "97": "color: #fff",
  };

  const parts: { text: string; style: string }[] = [];
  let currentStyle = "";
  let lastIndex = 0;
  const ansiRegex = /\x1b\[([0-9;]*)m/g;
  let match;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({
        text: text.slice(lastIndex, match.index),
        style: currentStyle,
      });
    }
    const codes = match[1].split(";");
    for (const code of codes) {
      if (code === "0" || code === "") {
        currentStyle = "";
      } else if (code === "1") {
        currentStyle += "font-weight: bold;";
      } else if (ansiColors[code]) {
        currentStyle += ansiColors[code] + ";";
      }
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), style: currentStyle });
  }

  return parts;
};

const handleCopy = async () => {
  if (!selectedExecution.value) return;
  try {
    const plainText = (selectedExecution.value.output || "").replace(
      /\x1b\[[0-9;]*m/g,
      "",
    );
    await navigator.clipboard.writeText(plainText);
    toast.success(t("operations.scripts.history.copied"));
  } catch {
    toast.error(t("operations.scripts.history.copyError"));
  }
};

watch(
  open,
  (isOpen) => {
    if (isOpen) {
      fetchExecutions();
    } else {
      showOutput.value = false;
      selectedExecution.value = null;
    }
  },
  { immediate: true },
);
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent
      class="!inset-0 flex !h-full !w-full flex-col overflow-hidden !border-0 sm:!inset-y-auto sm:!left-auto sm:!top-16 sm:!right-3 sm:!bottom-4 sm:!h-auto sm:!w-full sm:!max-w-3xl sm:!rounded-lg sm:!border"
      :show-close="true"
    >
      <SheetHeader class="flex-shrink-0 pb-4">
        <div class="flex items-center justify-between">
          <SheetTitle>
            <template v-if="showOutput && selectedExecution">
              <button
                class="mr-2 inline-flex items-center text-muted-foreground hover:text-foreground"
                :aria-label="t('operations.scripts.history.backToHistoryAria')"
                @click="showOutput = false"
              >
                <Icon name="lucide:arrow-left" class="h-4 w-4" />
              </button>
              {{ t("operations.scripts.history.executionOutput") }}
            </template>
            <template v-else>
              {{ t("operations.scripts.history.title", { name: script.name }) }}
            </template>
          </SheetTitle>
        </div>
      </SheetHeader>

      <div v-if="isLoading" class="flex flex-1 items-center justify-center">
        <Icon
          name="lucide:loader-2"
          class="h-8 w-8 animate-spin text-muted-foreground"
        />
      </div>

      <!-- Output view -->
      <template v-else-if="showOutput && selectedExecution">
        <div class="flex min-h-0 flex-1 flex-col gap-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Badge
                :variant="getStatusBadge(selectedExecution.status).variant"
              >
                {{ getStatusBadge(selectedExecution.status).label }}
              </Badge>
              <span class="text-sm text-muted-foreground">
                {{ selectedExecution.server_name }}
              </span>
              <span
                v-if="selectedExecution.exit_code !== null"
                class="text-xs text-muted-foreground"
              >
                {{
                  t("operations.scripts.history.exitCode", {
                    code: selectedExecution.exit_code,
                  })
                }}
              </span>
            </div>
            <Button variant="ghost" size="sm" @click="handleCopy">
              <Icon name="lucide:copy" class="mr-2 h-4 w-4" />
              {{ t("operations.scripts.common.copy") }}
            </Button>
          </div>

          <div class="min-h-0 flex-1 overflow-hidden rounded-lg bg-zinc-950">
            <ScrollArea class="h-full p-4">
              <pre
                class="whitespace-pre-wrap break-words font-mono text-sm text-zinc-100"
              ><template
                v-for="(part, index) in parseAnsi(selectedExecution.output || '')"
                :key="index"
              ><span :style="part.style">{{ part.text }}</span></template></pre>
            </ScrollArea>
          </div>
        </div>
      </template>

      <!-- Executions list -->
      <template v-else>
        <div
          v-if="executions.length === 0"
          class="flex flex-1 flex-col items-center justify-center gap-2"
        >
          <Icon name="lucide:history" class="h-12 w-12 text-muted-foreground" />
          <p class="text-sm text-muted-foreground">
            {{ t("operations.scripts.history.noExecutions") }}
          </p>
        </div>

        <ScrollArea v-else class="flex-1">
          <div class="space-y-2">
            <div
              v-for="execution in executions"
              :key="execution.id"
              class="flex cursor-pointer items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/50"
              @click="viewOutput(execution)"
            >
              <div class="flex items-center gap-3">
                <Badge :variant="getStatusBadge(execution.status).variant">
                  {{ getStatusBadge(execution.status).label }}
                </Badge>
                <div>
                  <p class="text-sm font-medium">{{ execution.server_name }}</p>
                  <p class="text-xs text-muted-foreground">
                    <SharedDateTooltip :date="execution.started_at" />
                  </p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <span
                  v-if="execution.exit_code !== null"
                  class="text-xs text-muted-foreground"
                >
                  {{
                    t("operations.scripts.history.exit", {
                      code: execution.exit_code,
                    })
                  }}
                </span>
                <Icon
                  name="lucide:chevron-right"
                  class="h-4 w-4 text-muted-foreground"
                />
              </div>
            </div>
          </div>
        </ScrollArea>
      </template>
    </SheetContent>
  </Sheet>
</template>
