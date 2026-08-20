<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

const { t } = useI18n();
useHead({ title: () => t("operations.scripts.list.pageTitle") });

interface Script {
  id: string;
  name: string;
  run_as: "root" | "local";
  content: string;
  user_id: string;
  team_id: string | null;
  created_at: string;
  updated_at: string;
}

const scripts = ref<Script[]>([]);
const isLoading = ref(true);
const selectedScript = ref<Script | null>(null);
const isEditDialogOpen = ref(false);
const isRunDialogOpen = ref(false);
const isHistoryDialogOpen = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Watch for refresh trigger from navbar
const scriptsRefreshKey = useState("scriptsRefreshKey", () => 0);
watch(scriptsRefreshKey, () => {
  fetchScripts();
});

const fetchScripts = async () => {
  try {
    const response = await $api<{ data: Script[] }>("/scripts");
    scripts.value = response.data;
  } catch {
    toast.error(t("operations.scripts.list.loadError"));
  } finally {
    isLoading.value = false;
  }
};

const editScript = (script: Script) => {
  selectedScript.value = script;
  isEditDialogOpen.value = true;
};

const runScript = (script: Script) => {
  selectedScript.value = script;
  isRunDialogOpen.value = true;
};

const viewHistory = (script: Script) => {
  selectedScript.value = script;
  isHistoryDialogOpen.value = true;
};

const handleScriptUpdated = () => {
  isEditDialogOpen.value = false;
  selectedScript.value = null;
  fetchScripts();
};

const handleScriptRan = () => {
  isRunDialogOpen.value = false;
  selectedScript.value = null;
  fetchScripts();
};

watch(isEditDialogOpen, (open) => {
  if (!open) selectedScript.value = null;
});

watch(isRunDialogOpen, (open) => {
  if (!open) selectedScript.value = null;
});

watch(isHistoryDialogOpen, (open) => {
  if (!open) selectedScript.value = null;
});

const deleteScript = async (script: Script) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("operations.scripts.list.deleteConfirmationTitle"),
    description: t("operations.scripts.list.deleteDescription", {
      name: script.name,
    }),
    confirmText: t("operations.scripts.common.delete"),
    cancelText: t("operations.scripts.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/scripts/${script.id}`, { method: "DELETE" });
      scripts.value = scripts.value.filter((s) => s.id !== script.id);
      toast.success(t("operations.scripts.list.deleted"));
    } catch {
      toast.error(t("operations.scripts.list.deleteError"));
    }
  }
};

onMounted(fetchScripts);
</script>

<template>
  <div class="pb-10">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Edit Script Dialog -->
    <ScriptsCreateScript
      v-if="selectedScript && isEditDialogOpen"
      v-model:open="isEditDialogOpen"
      :script="selectedScript"
      @updated="handleScriptUpdated"
    />

    <!-- Run Script Dialog -->
    <ScriptsRunScript
      v-if="selectedScript && isRunDialogOpen"
      v-model:open="isRunDialogOpen"
      :script="selectedScript"
      @ran="handleScriptRan"
    />

    <!-- Execution History -->
    <ScriptsExecutionHistory
      v-if="selectedScript && isHistoryDialogOpen"
      v-model:open="isHistoryDialogOpen"
      :script="selectedScript"
    />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="scripts.length === 0"
      class="flex h-[50vh] w-full flex-col items-center justify-center space-y-4 rounded-lg border bg-card"
    >
      <Icon name="lucide:scroll-text" class="h-16 w-16 text-muted-foreground" />
      <div class="text-center">
        <p class="font-medium">{{ t("operations.scripts.list.emptyTitle") }}</p>
        <p class="text-sm text-muted-foreground">
          {{ t("operations.scripts.list.emptyDescription") }}
        </p>
      </div>
    </div>

    <div v-else class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <div
        v-for="script in scripts"
        :key="script.id"
        class="group rounded-lg border bg-card p-4 transition-colors hover:bg-muted/50"
      >
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-start gap-3">
            <div
              class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted"
            >
              <Icon
                name="lucide:terminal"
                class="h-5 w-5 text-muted-foreground"
              />
            </div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold truncate">{{ script.name }}</h3>
            </div>
          </div>
          <div
            class="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100"
          >
            <Button
              variant="ghost"
              size="icon"
              :title="t('operations.scripts.list.runTitle')"
              :aria-label="t('operations.scripts.list.runTitle')"
              @click.stop="runScript(script)"
            >
              <Icon name="lucide:play" class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :title="t('operations.scripts.list.historyTitle')"
              :aria-label="t('operations.scripts.list.historyTitle')"
              @click.stop="viewHistory(script)"
            >
              <Icon name="lucide:history" class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :title="t('operations.scripts.list.editTitle')"
              :aria-label="t('operations.scripts.list.editTitle')"
              @click.stop="editScript(script)"
            >
              <Icon name="lucide:pencil" class="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              :title="t('operations.scripts.list.deleteTitle')"
              :aria-label="t('operations.scripts.list.deleteTitle')"
              class="hover:bg-destructive/90 hover:text-white"
              @click.stop="deleteScript(script)"
            >
              <Icon name="lucide:trash-2" class="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div class="mt-4 flex items-center justify-between text-sm">
          <Badge variant="outline" class="text-xs">
            {{
              script.run_as === "root"
                ? t("operations.scripts.common.root")
                : t("operations.scripts.common.captain")
            }}
          </Badge>
          <SharedDateTooltip :date="script.created_at" />
        </div>
      </div>
    </div>
  </div>
</template>
