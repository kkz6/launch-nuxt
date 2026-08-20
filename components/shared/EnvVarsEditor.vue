<script setup lang="ts">
import { reactive, ref, toRefs } from "vue";
import { useClipboard } from "@vueuse/core";
import { toast } from "vue-sonner";
import { parseDotEnv } from "~/composables/useDockerHelpers";

interface EnvVarRow {
  id: string;
  key: string;
  value: string;
  is_secret: boolean;
}

interface CreateData {
  key: string;
  value: string;
  is_secret?: boolean;
}

interface UpdatePatch {
  value?: string;
  is_secret?: boolean;
}

interface Props {
  vars: EnvVarRow[];
  loading?: boolean;
  title?: string;
  description?: string;
  showProjectHint?: boolean;
  emptyDescription?: string;
  isRunning?: boolean;
  onRestart?: () => Promise<void>;
  restartLabel?: string;
  onSetBulk?: (rows: CreateData[]) => Promise<EnvVarRow[]>;
  onCreate: (data: CreateData) => Promise<EnvVarRow>;
  onUpdate: (id: string, patch: UpdatePatch) => Promise<EnvVarRow>;
  onDelete: (id: string) => Promise<void>;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  showProjectHint: false,
  isRunning: false,
  onRestart: undefined,
  onSetBulk: undefined,
});

const { t } = useI18n();
const resolvedTitle = computed(
  () => props.title || t("shared.envVars.defaultTitle"),
);
const resolvedDescription = computed(
  () => props.description || t("shared.envVars.defaultDescription"),
);

const emit = defineEmits<{
  "update:vars": [EnvVarRow[]];
}>();

const state = reactive({
  isSaving: false,
  showAddForm: false,
  newVar: { key: "", value: "", is_secret: false },
  bulkOpen: false,
  bulkText: "",
  bulkMode: "append" as "append" | "replace",
  editing: {} as Record<string, { value: string; isSecret: boolean }>,
  revealed: {} as Record<string, boolean>,
  isRestarting: false,
});
const {
  isSaving,
  showAddForm,
  bulkOpen,
  bulkText,
  bulkMode,
  editing,
  revealed,
  isRestarting,
} = toRefs(state);
const newVar = state.newVar;
const { copy } = useClipboard();

watch(showAddForm, async (open) => {
  if (!open) return;
  await nextTick();
  const el = document.getElementById("env-key") as HTMLInputElement | null;
  el?.focus();
});

const closeAddForm = () => {
  showAddForm.value = false;
  newVar.key = "";
  newVar.value = "";
  newVar.is_secret = false;
};

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const toggleReveal = (v: EnvVarRow) => {
  revealed.value = {
    ...revealed.value,
    [v.id]: !revealed.value[v.id],
  };
};

const startEdit = (v: EnvVarRow) => {
  const prefill = v.is_secret && !revealed.value[v.id] ? "" : v.value;
  editing.value[v.id] = {
    value: prefill,
    isSecret: v.is_secret,
  };
  nextTick(() => {
    document.getElementById(`env-edit-${v.id}`)?.focus();
  });
};
const cancelEdit = (id: string) => {
  delete editing.value[id];
  editing.value = { ...editing.value };
};
const saveEdit = async (v: EnvVarRow) => {
  const next = editing.value[v.id];
  if (!next) return;
  const patch: UpdatePatch = {};
  const userTypedValue =
    next.value !== "" || !v.is_secret || !!revealed.value[v.id];
  if (userTypedValue && next.value !== v.value) {
    patch.value = next.value;
  }
  if (next.isSecret !== v.is_secret) {
    patch.is_secret = next.isSecret;
  }
  if (Object.keys(patch).length === 0) {
    cancelEdit(v.id);
    return;
  }
  try {
    const updated = await props.onUpdate(v.id, patch);
    syncRow(updated);
    if (!updated.is_secret) {
      delete revealed.value[v.id];
      revealed.value = { ...revealed.value };
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.envVars.updateFailed"));
    return;
  }
  cancelEdit(v.id);
  await promptRestart();
};

const copyValue = async (v: EnvVarRow) => {
  if (!v.value) {
    toast.error(t("shared.envVars.nothingToCopy"));
    return;
  }
  try {
    await copy(v.value);
    toast.success(t("shared.envVars.copied", { key: v.key }));
  } catch {
    toast.error(t("shared.envVars.clipboardFailed"));
  }
};

const addVar = async () => {
  const key = newVar.key.trim();
  if (!key) {
    toast.error(t("shared.envVars.keyRequired"));
    return;
  }
  isSaving.value = true;
  try {
    const created = await props.onCreate({
      key,
      value: newVar.value,
      is_secret: newVar.is_secret,
    });
    emit("update:vars", sortVars([...props.vars, created]));
    closeAddForm();
    toast.success(t("shared.envVars.added"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.envVars.addFailed"));
    return;
  } finally {
    isSaving.value = false;
  }
  await promptRestart();
};

const toggleSecret = async (v: EnvVarRow) => {
  try {
    const updated = await props.onUpdate(v.id, { is_secret: !v.is_secret });
    syncRow(updated);
    if (updated.is_secret) {
      delete revealed.value[v.id];
      revealed.value = { ...revealed.value };
    }
    toast.success(
      t(
        updated.is_secret ? "shared.envVars.masked" : "shared.envVars.unmasked",
        { key: v.key },
      ),
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.envVars.updateFailed"));
  }
};

const removeVar = async (v: EnvVarRow) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("shared.envVars.removeTitle"),
    description: t("shared.envVars.removeDescription", { key: v.key }),
    confirmText: t("shared.envVars.remove"),
    cancelText: t("common.cancel"),
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await props.onDelete(v.id);
    emit(
      "update:vars",
      props.vars.filter((x) => x.id !== v.id),
    );
    toast.success(t("shared.envVars.removed"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.envVars.removeFailed"));
    return;
  }
  await promptRestart();
};

const parsedBulk = computed(() => {
  const rows = parseDotEnv(bulkText.value).map(({ key, value }) => ({
    key,
    value,
    is_secret: false,
  }));
  const existingKeys = new Set(props.vars.map((v) => v.key));
  const duplicates = rows.filter((r) => existingKeys.has(r.key)).length;
  return { rows, duplicates };
});

const openBulkDialog = () => {
  bulkText.value = "";
  bulkMode.value = "append";
  bulkOpen.value = true;
};

const submitBulk = async () => {
  const { rows, duplicates } = parsedBulk.value;
  if (rows.length === 0) {
    toast.error(t("shared.envVars.noValidLines"));
    return;
  }

  if (bulkMode.value === "replace") {
    if (!props.onSetBulk) {
      toast.error(t("shared.envVars.replaceUnsupported"));
      return;
    }
    if (!confirmationDialog.value) return;
    const result = await confirmationDialog.value.show({
      title: t("shared.envVars.replaceTitle"),
      description: t("shared.envVars.replaceDescription", {
        existing: props.vars.length,
        replacement: rows.length,
      }),
      confirmText: t("shared.envVars.replace"),
      cancelText: t("common.cancel"),
      destructive: true,
    });
    if (!result.ok) return;
    isSaving.value = true;
    try {
      const next = await props.onSetBulk(rows);
      emit("update:vars", sortVars(next));
      bulkOpen.value = false;
      bulkText.value = "";
      toast.success(t("shared.envVars.savedCount", { count: next.length }));
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e.data?.message || t("shared.envVars.saveFailed"));
      return;
    } finally {
      isSaving.value = false;
    }
    await promptRestart();
    return;
  }

  const existingKeys = new Set(props.vars.map((v) => v.key));
  const toAdd = rows.filter((r) => !existingKeys.has(r.key));
  if (toAdd.length === 0) {
    toast.error(t("shared.envVars.allExist", { count: rows.length }));
    return;
  }
  isSaving.value = true;
  let created = 0;
  const errs: string[] = [];
  const newRows: EnvVarRow[] = [];
  for (const row of toAdd) {
    try {
      newRows.push(await props.onCreate(row));
      created++;
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      errs.push(
        `${row.key}: ${e.data?.message || t("shared.envVars.itemFailed")}`,
      );
    }
  }
  emit("update:vars", sortVars([...props.vars, ...newRows]));
  if (created > 0) {
    toast.success(
      duplicates > 0
        ? t("shared.envVars.addedCountWithSkipped", {
            count: created,
            skipped: duplicates,
          })
        : t("shared.envVars.addedCount", { count: created }),
    );
  }
  if (errs.length > 0) {
    toast.error(
      t("shared.envVars.bulkFailed", {
        count: errs.length,
        errors: errs.slice(0, 3).join("; "),
      }),
    );
  }
  if (errs.length === 0) {
    bulkOpen.value = false;
    bulkText.value = "";
  }
  isSaving.value = false;
  if (created > 0) {
    await promptRestart();
  }
};

const onKeyPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData("text") ?? "";
  if (!text.includes("\n") && !text.includes("=")) return;
  const parsed = parseDotEnv(text);
  if (parsed.length < 2) return;
  event.preventDefault();
  bulkText.value = text;
  bulkMode.value = "append";
  bulkOpen.value = true;
  closeAddForm();
};

const syncRow = (updated: EnvVarRow) => {
  emit(
    "update:vars",
    props.vars.map((x) => (x.id === updated.id ? updated : x)),
  );
};

const sortVars = (vars: EnvVarRow[]) =>
  [...vars].sort((a, b) => a.key.localeCompare(b.key));

const promptRestart = async () => {
  if (!props.isRunning || !props.onRestart || !confirmationDialog.value) return;

  const label = props.restartLabel || t("shared.envVars.restart");
  const result = await confirmationDialog.value.show({
    title: t("shared.envVars.restartTitle", { action: label }),
    description: t("shared.envVars.restartDescription", { action: label }),
    confirmText: label,
    cancelText: t("shared.envVars.notNow"),
  });

  if (!result.ok) return;

  isRestarting.value = true;
  try {
    await props.onRestart();
    toast.success(t("shared.envVars.restartTriggered", { action: label }));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("shared.envVars.restartFailed", { action: label }),
    );
  } finally {
    isRestarting.value = false;
  }
};

const resolvedEmptyDescription = computed(() => {
  if (props.emptyDescription) return props.emptyDescription;
  return props.showProjectHint
    ? t("shared.envVars.emptyWorkload")
    : t("shared.envVars.emptyProject", { reference: "${{project.KEY}}" });
});
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <div class="flex flex-wrap items-center gap-2.5">
          <h3 class="text-base font-semibold tracking-tight">
            {{ resolvedTitle }}
          </h3>
          <span
            class="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border/70 bg-muted/50 px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
            :title="t('shared.envVars.encryptionTitle')"
          >
            <Icon name="lucide:shield-check" class="h-3 w-3" />
            {{ t("shared.envVars.encryptedAtRest") }}
          </span>
        </div>
        <p
          class="max-w-prose text-[13px] leading-relaxed text-muted-foreground"
        >
          {{ resolvedDescription }}
        </p>
      </div>
      <div class="flex shrink-0 gap-2">
        <Button
          size="icon-sm"
          variant="outline"
          class="press"
          :title="t('shared.envVars.pasteTitle')"
          :aria-label="t('shared.envVars.pasteAria')"
          @click="openBulkDialog"
        >
          <Icon name="lucide:clipboard-paste" class="h-4 w-4" />
        </Button>

        <Button
          size="icon-sm"
          :variant="showAddForm ? 'outline' : 'default'"
          class="press"
          :title="
            showAddForm ? t('shared.envVars.close') : t('shared.envVars.addVar')
          "
          :aria-label="
            showAddForm ? t('shared.envVars.close') : t('shared.envVars.addVar')
          "
          @click="showAddForm ? closeAddForm() : (showAddForm = true)"
        >
          <Icon
            name="lucide:plus"
            class="h-4 w-4 transition-transform duration-200"
            :class="showAddForm ? 'rotate-45' : ''"
          />
        </Button>
      </div>
    </div>

    <div
      v-if="showProjectHint"
      class="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/40 px-3.5 py-2.5 text-[13px] leading-relaxed text-muted-foreground"
    >
      <Icon
        name="lucide:info"
        class="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/70"
      />
      <I18nT keypath="shared.envVars.projectHint" tag="p">
        <template #reference>
          <code
            v-pre
            class="rounded bg-foreground/[0.06] px-1.5 py-0.5 font-mono text-[12px] text-foreground"
            >${{ project.KEY }}</code
          >
        </template>
        <template #secrets>
          <span class="font-medium text-foreground">
            {{ t("shared.envVars.buildSecrets") }}
          </span>
        </template>
      </I18nT>
    </div>

    <Transition name="env-add-form">
      <form
        v-if="showAddForm"
        class="space-y-3 overflow-hidden rounded-lg border border-border/60 bg-muted/40 p-4"
        @submit.prevent="addVar"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="env-key" class="text-xs">
              {{ t("shared.envVars.key") }}
            </Label>
            <Input
              id="env-key"
              v-model="newVar.key"
              class="h-9 font-mono text-sm"
              placeholder="DATABASE_URL"
              autocomplete="off"
              spellcheck="false"
              @paste="onKeyPaste"
            />
          </div>
          <div class="space-y-1">
            <Label for="env-value" class="text-xs">
              {{ t("shared.envVars.value") }}
            </Label>
            <Input
              id="env-value"
              v-model="newVar.value"
              :type="newVar.is_secret ? 'password' : 'text'"
              class="h-9 font-mono text-sm"
              autocomplete="off"
              spellcheck="false"
              @paste="onKeyPaste"
            />
          </div>
        </div>
        <div class="flex items-center justify-between gap-2">
          <label class="flex cursor-pointer items-center gap-2 text-xs">
            <input
              v-model="newVar.is_secret"
              type="checkbox"
              class="h-3.5 w-3.5 rounded border-input accent-primary"
            />
            {{ t("shared.envVars.treatAsSecret") }}
          </label>
          <div class="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              :disabled="isSaving"
              @click="closeAddForm"
            >
              {{ t("common.cancel") }}
            </Button>
            <Button type="submit" size="sm" :disabled="isSaving">
              <Icon
                v-if="isSaving"
                name="lucide:loader-2"
                class="mr-2 h-3.5 w-3.5 animate-spin"
              />
              {{ t("shared.envVars.add") }}
            </Button>
          </div>
        </div>
      </form>
    </Transition>

    <div
      class="overflow-hidden rounded-lg border border-border/50 bg-background/40"
    >
      <div v-if="loading" class="flex items-center justify-center py-16">
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <div
        v-else-if="vars.length === 0"
        class="flex flex-col items-center justify-center px-6 py-12 text-center"
      >
        <div
          class="flex h-11 w-11 items-center justify-center rounded-lg border border-border/40 bg-muted/30"
        >
          <Icon name="lucide:key" class="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 class="mt-3.5 text-[15px] font-semibold tracking-tight">
          {{ t("shared.envVars.emptyTitle") }}
        </h3>
        <p
          class="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground"
        >
          {{ resolvedEmptyDescription }}
        </p>
      </div>

      <template v-else>
        <div
          class="grid grid-cols-[220px_1fr_168px] gap-2 border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          <div>{{ t("shared.envVars.key") }}</div>
          <div>{{ t("shared.envVars.value") }}</div>
          <div class="text-right">{{ t("shared.envVars.actions") }}</div>
        </div>

        <div
          v-for="v in vars"
          :key="v.id"
          class="grid grid-cols-[220px_1fr_168px] items-center gap-2 border-b border-border/40 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40"
        >
          <div class="flex min-w-0 items-center gap-1.5">
            <code class="truncate font-mono text-[13px]" :title="v.key">
              {{ v.key }}
            </code>
            <button
              type="button"
              class="shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors"
              :class="
                v.is_secret
                  ? 'border-border/70 bg-muted text-foreground/80 hover:bg-muted/70'
                  : 'border-transparent bg-transparent text-muted-foreground/70 hover:bg-muted'
              "
              :title="
                v.is_secret
                  ? t('shared.envVars.unmaskTitle')
                  : t('shared.envVars.maskTitle')
              "
              @click="toggleSecret(v)"
            >
              {{
                v.is_secret
                  ? t("shared.envVars.secret")
                  : t("shared.envVars.plain")
              }}
            </button>
          </div>

          <div class="min-w-0">
            <div v-if="editing[v.id]" class="space-y-1.5">
              <Input
                :id="`env-edit-${v.id}`"
                v-model="editing[v.id].value"
                :type="
                  editing[v.id].isSecret && !revealed[v.id]
                    ? 'password'
                    : 'text'
                "
                class="h-9 w-full font-mono text-xs"
                :placeholder="
                  v.is_secret && !revealed[v.id]
                    ? t('shared.envVars.leaveBlank')
                    : ''
                "
                autocomplete="off"
                spellcheck="false"
                @keyup.enter="saveEdit(v)"
                @keyup.esc="cancelEdit(v.id)"
              />
              <label
                class="flex w-fit cursor-pointer items-center gap-2 text-[11px] text-muted-foreground"
              >
                <input
                  v-model="editing[v.id].isSecret"
                  type="checkbox"
                  class="h-3 w-3 rounded border-input accent-primary"
                />
                {{ t("shared.envVars.treatAsSecret") }}
              </label>
            </div>

            <button
              v-else
              type="button"
              :title="
                v.is_secret && !revealed[v.id]
                  ? t('shared.envVars.clickEditHidden')
                  : t('shared.envVars.clickEdit')
              "
              class="group/value -mx-1 flex w-full max-w-full items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-muted/60"
              @click="startEdit(v)"
            >
              <span
                v-if="v.is_secret && !revealed[v.id]"
                class="select-none truncate font-mono text-xs tracking-widest text-muted-foreground"
                :aria-label="t('shared.envVars.valueHidden')"
              >
                ••••••••
              </span>
              <span
                v-else
                class="truncate font-mono text-xs text-muted-foreground group-hover/value:text-foreground"
              >
                {{ v.value || t("shared.envVars.emptyValue") }}
              </span>
              <Icon
                name="lucide:pencil"
                class="ml-auto h-3 w-3 shrink-0 text-muted-foreground/0 transition-opacity group-hover/value:text-muted-foreground"
              />
            </button>
          </div>

          <div class="flex justify-end gap-0.5">
            <template v-if="editing[v.id]">
              <Button
                variant="default"
                size="icon-sm"
                :title="t('shared.envVars.saveChanges')"
                :aria-label="t('shared.envVars.saveChanges')"
                @click="saveEdit(v)"
              >
                <Icon name="lucide:check" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.envVars.cancelEdit')"
                :aria-label="t('shared.envVars.cancelEdit')"
                @click="cancelEdit(v.id)"
              >
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </template>

            <template v-else>
              <Button
                v-if="v.is_secret"
                variant="ghost"
                size="icon-sm"
                :title="
                  revealed[v.id]
                    ? t('shared.envVars.hideValue')
                    : t('shared.envVars.revealValue')
                "
                :aria-label="
                  revealed[v.id]
                    ? t('shared.envVars.hideValue')
                    : t('shared.envVars.revealValue')
                "
                @click="toggleReveal(v)"
              >
                <Icon
                  :name="revealed[v.id] ? 'lucide:eye-off' : 'lucide:eye'"
                  class="h-3.5 w-3.5"
                />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.envVars.copyValue')"
                :aria-label="t('shared.envVars.copyValue')"
                :disabled="!v.value"
                @click="copyValue(v)"
              >
                <Icon name="lucide:copy" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.envVars.edit')"
                :aria-label="t('shared.envVars.edit')"
                @click="startEdit(v)"
              >
                <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.envVars.removeTitle')"
                :aria-label="t('shared.envVars.removeTitle')"
                class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                @click="removeVar(v)"
              >
                <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
              </Button>
            </template>
          </div>
        </div>
      </template>
    </div>

    <p class="text-[11px] text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      {{ t("shared.envVars.runningHint") }}
    </p>

    <Dialog v-model:open="bulkOpen">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle class="text-base">
            {{ t("shared.envVars.bulkTitle") }}
          </DialogTitle>
          <DialogDescription class="text-xs">
            {{ t("shared.envVars.bulkDescription") }}
          </DialogDescription>
        </DialogHeader>

        <SharedCodeEditor
          v-model="bulkText"
          :line-numbers="true"
          :fold-gutter="false"
          :line-wrapping="true"
          placeholder="DATABASE_URL=postgres://...
NODE_ENV=production
LOG_LEVEL=info"
          class="h-64"
        />

        <div
          v-if="bulkText.trim().length > 0"
          class="rounded-md border bg-muted/30 px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <Icon
              :name="
                parsedBulk.rows.length > 0
                  ? 'lucide:check-circle-2'
                  : 'lucide:alert-circle'
              "
              :class="[
                'h-3.5 w-3.5',
                parsedBulk.rows.length > 0
                  ? 'text-emerald-600'
                  : 'text-amber-600',
              ]"
            />
            <span>
              {{
                t("shared.envVars.validEntries", {
                  count: parsedBulk.rows.length,
                })
              }}
              <template v-if="parsedBulk.duplicates > 0">
                ·
                {{
                  t("shared.envVars.duplicatesSkipped", {
                    count: parsedBulk.duplicates,
                  })
                }}
              </template>
            </span>
          </div>
        </div>

        <div v-if="onSetBulk" class="space-y-2">
          <Label class="text-xs">{{ t("shared.envVars.whenApplying") }}</Label>
          <div class="flex gap-4">
            <label class="flex cursor-pointer items-center gap-2 text-xs">
              <input
                v-model="bulkMode"
                type="radio"
                value="append"
                class="h-3.5 w-3.5 accent-primary"
              />
              {{ t("shared.envVars.append") }}
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-xs">
              <input
                v-model="bulkMode"
                type="radio"
                value="replace"
                class="h-3.5 w-3.5 accent-primary"
              />
              {{ t("shared.envVars.replaceAll") }}
              <span class="text-[10px] text-muted-foreground">
                {{ t("shared.envVars.destructive") }}
              </span>
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            :disabled="isSaving"
            @click="bulkOpen = false"
          >
            {{ t("common.cancel") }}
          </Button>
          <Button
            size="sm"
            :disabled="isSaving || parsedBulk.rows.length === 0"
            @click="submitBulk"
          >
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-3.5 w-3.5 animate-spin"
            />
            {{
              bulkMode === "replace"
                ? t("shared.envVars.replaceAll")
                : t("shared.envVars.add")
            }}
            {{
              parsedBulk.rows.length > 0 ? `(${parsedBulk.rows.length})` : ""
            }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
.env-add-form-enter-active,
.env-add-form-leave-active {
  transition:
    max-height 200ms ease-out,
    opacity 180ms ease-out,
    transform 200ms ease-out;
}

.env-add-form-enter-from,
.env-add-form-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.env-add-form-enter-to,
.env-add-form-leave-from {
  max-height: 24rem;
  opacity: 1;
  transform: translateY(0);
}
</style>
