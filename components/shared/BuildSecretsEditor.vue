<script setup lang="ts">
import { toast } from "vue-sonner";

/**
 * Generic build-time secret row. Mirrors DockerBuildSecret but kept
 * structurally minimal so the editor can render application AND
 * compose secrets without type branching. The owner-FK field is
 * opaque to this component.
 *
 * Crucially: there's no `value` field on the read path. Build-secret
 * values are never returned by the API after they're written, so the
 * editor only ever knows whether a row has a value (`has_value`),
 * never what it is. Editing is always "replace the value".
 */
interface BuildSecretRow {
  id: string;
  name: string;
  has_value: boolean;
  created_at?: string;
  updated_at?: string;
}

interface CreateData {
  name: string;
  value: string;
}

interface UpdatePatch {
  value: string;
}

interface Props {
  secrets: BuildSecretRow[];
  loading?: boolean;
  /** Owner label shown in confirmation copy — "application" or "stack". */
  ownerLabel?: string;
  /**
   * When true, the editor surfaces the GitHub Actions naming contract:
   * each secret `FOO` is pushed to the repo as a `LAUNCH_BUILD_FOO`
   * Actions secret (while the Dockerfile `id=` stays the short `FOO`).
   * Off for the plain server-build path, where there's no repo secret.
   */
  githubActions?: boolean;
  onCreate: (data: CreateData) => Promise<BuildSecretRow>;
  onUpdate: (id: string, patch: UpdatePatch) => Promise<BuildSecretRow>;
  onDelete: (id: string) => Promise<void>;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  ownerLabel: "application",
  githubActions: false,
});
const { t } = useI18n();

// Must match the backend: gha_bootstrap_workflow.go pushes each build
// secret as ("LAUNCH_BUILD_" + name) verbatim, and the workflow YAML
// references it via ${{ secrets.LAUNCH_BUILD_<NAME> }}. Keep in sync.
const REPO_SECRET_PREFIX = "LAUNCH_BUILD_";
const repoSecretName = (name: string) => REPO_SECRET_PREFIX + name;

const emit = defineEmits<{
  /** Fires after every successful create/update/delete so the wrapper
   *  can sync its list ref. Same convention as SharedEnvVarsEditor. */
  "update:secrets": [BuildSecretRow[]];
}>();

const isSaving = ref(false);
const showAddForm = ref(false);
const newSecret = reactive({ name: "", value: "" });

watch(showAddForm, async (open) => {
  if (!open) return;
  await nextTick();
  const el = document.getElementById(
    "build-secret-name",
  ) as HTMLInputElement | null;
  el?.focus();
});

const closeAddForm = () => {
  showAddForm.value = false;
  newSecret.name = "";
  newSecret.value = "";
};

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

// Per-row replace-value state. Different from env-var editing in that
// the input is ALWAYS empty when we open it (we don't have the old
// value to pre-fill). Saving with a blank field is a no-op rather
// than a destructive "clear value" — to actually clear, the user
// deletes the row and re-adds it.
const editing = ref<Record<string, { value: string }>>({});

const startEdit = (s: BuildSecretRow) => {
  editing.value[s.id] = { value: "" };
  nextTick(() => {
    document.getElementById(`build-secret-edit-${s.id}`)?.focus();
  });
};

const cancelEdit = (id: string) => {
  delete editing.value[id];
  editing.value = { ...editing.value };
};

const saveEdit = async (s: BuildSecretRow) => {
  const next = editing.value[s.id];
  if (!next) return;
  // Blank → no-op. We don't want a stray Enter to silently overwrite
  // the secret with the empty string.
  if (next.value === "") {
    cancelEdit(s.id);
    return;
  }
  try {
    const updated = await props.onUpdate(s.id, { value: next.value });
    syncRow(updated);
    toast.success(t("shared.buildSecrets.updated", { name: s.name }));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.buildSecrets.updateFailed"));
    return;
  }
  cancelEdit(s.id);
};

const addSecret = async () => {
  const name = newSecret.name.trim();
  if (!name) {
    toast.error(t("shared.buildSecrets.nameRequired"));
    return;
  }
  isSaving.value = true;
  try {
    const created = await props.onCreate({
      name,
      value: newSecret.value,
    });
    emit("update:secrets", sortByName([...props.secrets, created]));
    closeAddForm();
    toast.success(t("shared.buildSecrets.added"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.buildSecrets.addFailed"));
  } finally {
    isSaving.value = false;
  }
};

const removeSecret = async (s: BuildSecretRow) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("shared.buildSecrets.removeTitle"),
    description: t("shared.buildSecrets.removeDescription", { name: s.name }),
    confirmText: t("shared.buildSecrets.remove"),
    cancelText: t("common.cancel"),
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await props.onDelete(s.id);
    emit(
      "update:secrets",
      props.secrets.filter((x) => x.id !== s.id),
    );
    toast.success(t("shared.buildSecrets.removed"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("shared.buildSecrets.removeFailed"));
  }
};

const syncRow = (updated: BuildSecretRow) => {
  emit(
    "update:secrets",
    props.secrets.map((x) => (x.id === updated.id ? updated : x)),
  );
};

const sortByName = (rows: BuildSecretRow[]) =>
  [...rows].sort((a, b) => a.name.localeCompare(b.name));
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h3 class="text-base font-semibold tracking-tight">
          {{ t("shared.buildSecrets.title") }}
        </h3>
        <p
          class="max-w-prose text-[13px] leading-relaxed text-muted-foreground"
        >
          {{ t("shared.buildSecrets.description") }}
        </p>
      </div>
      <Button
        size="icon-sm"
        :variant="showAddForm ? 'outline' : 'default'"
        :title="
          showAddForm
            ? t('shared.buildSecrets.close')
            : t('shared.buildSecrets.addSecret')
        "
        :aria-label="
          showAddForm
            ? t('shared.buildSecrets.close')
            : t('shared.buildSecrets.addSecret')
        "
        class="press shrink-0"
        @click="showAddForm ? closeAddForm() : (showAddForm = true)"
      >
        <Icon
          name="lucide:plus"
          class="h-4 w-4 transition-transform duration-200"
          :class="showAddForm ? 'rotate-45' : ''"
        />
      </Button>
    </div>

    <!--
      Add form. Inline (vs modal) so the user can see the existing
      rows + the form at the same time — useful when porting a
      Dockerfile that references several secrets.

      Same sky-tinted accent as the env-var editor's add form so the
      two surfaces feel related.
    -->
    <Transition name="build-secret-add">
      <form
        v-if="showAddForm"
        class="space-y-3 overflow-hidden rounded-lg border border-border/60 bg-muted/40 p-4"
        @submit.prevent="addSecret"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-[220px_1fr]">
          <div class="space-y-1">
            <Label for="build-secret-name" class="text-xs">
              {{ t("shared.buildSecrets.name") }}
            </Label>
            <Input
              id="build-secret-name"
              v-model="newSecret.name"
              class="h-9 font-mono text-sm"
              placeholder="NPM_TOKEN"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
          <div class="space-y-1">
            <Label for="build-secret-value" class="text-xs">
              {{ t("shared.buildSecrets.value") }}
            </Label>
            <Input
              id="build-secret-value"
              v-model="newSecret.value"
              type="password"
              class="h-9 font-mono text-sm"
              autocomplete="off"
              spellcheck="false"
            />
          </div>
        </div>
        <p class="text-[11px] text-muted-foreground">
          {{ t("shared.buildSecrets.dockerfileReference") }}
          <code class="rounded bg-muted px-1 py-0.5 text-[10px]">
            RUN --mount=type=secret,id={{ newSecret.name || "NPM_TOKEN" }} cat
            /run/secrets/{{ newSecret.name || "NPM_TOKEN" }} </code
          >.
        </p>
        <p
          v-if="githubActions"
          class="flex items-start gap-1.5 rounded-md border border-border/60 bg-muted/40 px-2.5 py-2 text-[11px] text-muted-foreground"
        >
          <Icon name="lucide:key-round" class="mt-0.5 h-3 w-3 shrink-0" />
          <span>
            {{ t("shared.buildSecrets.githubPrefix") }}
            <code
              class="rounded bg-muted px-1 py-0.5 text-[10px] font-medium text-foreground"
              >{{ repoSecretName(newSecret.name || "NPM_TOKEN") }}</code
            >
            {{ t("shared.buildSecrets.githubMiddle") }}
            <code class="rounded bg-muted px-1 py-0.5 text-[10px]">{{
              newSecret.name || "NPM_TOKEN"
            }}</code>
            {{ t("shared.buildSecrets.githubSuffix") }}
          </span>
        </p>
        <div class="flex justify-end gap-2">
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
            {{ t("shared.buildSecrets.add") }}
          </Button>
        </div>
      </form>
    </Transition>

    <!--
      Existing-rows list. Same flat-card pattern as the GHA tab's
      Configuration section — the bordered card carries either a
      loader, an empty inline state, or the row list. Build secret
      values are never displayed; each row shows the name + a
      green "set" indicator instead.
    -->
    <div
      class="overflow-hidden rounded-lg border border-border/50 bg-background/40"
    >
      <div v-if="loading" class="flex items-center justify-center py-12">
        <Icon
          name="lucide:loader-2"
          class="h-5 w-5 animate-spin text-muted-foreground"
        />
      </div>

      <div
        v-else-if="secrets.length === 0"
        class="flex flex-col items-center justify-center px-6 py-10 text-center"
      >
        <div
          class="flex h-11 w-11 items-center justify-center rounded-lg border border-border/40 bg-muted/30"
        >
          <Icon name="lucide:shield" class="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 class="mt-3.5 text-[15px] font-semibold tracking-tight">
          {{ t("shared.buildSecrets.emptyTitle") }}
        </h3>
        <p
          class="mt-1.5 max-w-md text-[13px] leading-relaxed text-muted-foreground"
        >
          {{ t("shared.buildSecrets.emptyDescription") }}
        </p>
      </div>

      <template v-else>
        <div
          class="grid grid-cols-[220px_1fr_140px] gap-2 border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground"
        >
          <div>{{ t("shared.buildSecrets.name") }}</div>
          <div>{{ t("shared.buildSecrets.value") }}</div>
          <div class="text-right">{{ t("shared.buildSecrets.actions") }}</div>
        </div>

        <div
          v-for="s in secrets"
          :key="s.id"
          class="grid grid-cols-[220px_1fr_140px] items-center gap-2 border-b border-border/40 px-4 py-2.5 transition-colors last:border-b-0 hover:bg-muted/40"
        >
          <div class="flex min-w-0 flex-col justify-center">
            <code class="truncate font-mono text-[13px]" :title="s.name">
              {{ s.name }}
            </code>
            <code
              v-if="githubActions"
              class="truncate font-mono text-[10px] text-muted-foreground/70"
              :title="
                t('shared.buildSecrets.repositorySecret', {
                  name: repoSecretName(s.name),
                })
              "
            >
              {{ repoSecretName(s.name) }}
            </code>
          </div>

          <!--
            Value column. Two modes:
              - editing[s.id] truthy → replace-value Input (always blank)
              - otherwise            → "set" pill + helpful caption
          -->
          <div class="min-w-0">
            <div v-if="editing[s.id]" class="space-y-1">
              <Input
                :id="`build-secret-edit-${s.id}`"
                v-model="editing[s.id].value"
                type="password"
                class="h-9 w-full font-mono text-xs"
                :placeholder="t('shared.buildSecrets.newValuePlaceholder')"
                autocomplete="off"
                spellcheck="false"
                @keyup.enter="saveEdit(s)"
                @keyup.esc="cancelEdit(s.id)"
              />
              <p class="text-[10px] text-muted-foreground">
                {{ t("shared.buildSecrets.existingHidden") }}
              </p>
            </div>
            <div v-else class="flex items-center gap-1.5">
              <span
                v-if="s.has_value"
                class="inline-flex items-center gap-1 rounded border border-border/70 bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-foreground/80"
              >
                <Icon name="lucide:check" class="h-2.5 w-2.5" />
                {{ t("shared.buildSecrets.set") }}
              </span>
              <span
                v-else
                class="inline-flex items-center gap-1 rounded border border-destructive/30 bg-destructive/5 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-destructive"
              >
                <Icon name="lucide:alert-triangle" class="h-2.5 w-2.5" />
                {{ t("shared.buildSecrets.empty") }}
              </span>
              <span class="font-mono text-[11px] text-muted-foreground/80">
                {{ t("shared.buildSecrets.valueHidden") }}
              </span>
            </div>
          </div>

          <div class="flex justify-end gap-0.5">
            <template v-if="editing[s.id]">
              <Button
                variant="default"
                size="icon-sm"
                :title="t('shared.buildSecrets.save')"
                :aria-label="t('shared.buildSecrets.save')"
                @click="saveEdit(s)"
              >
                <Icon name="lucide:check" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('common.cancel')"
                :aria-label="t('common.cancel')"
                @click="cancelEdit(s.id)"
              >
                <Icon name="lucide:x" class="h-3.5 w-3.5" />
              </Button>
            </template>
            <template v-else>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.buildSecrets.replaceValue')"
                :aria-label="t('shared.buildSecrets.replaceValue')"
                @click="startEdit(s)"
              >
                <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                :title="t('shared.buildSecrets.remove')"
                :aria-label="t('shared.buildSecrets.remove')"
                class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                @click="removeSecret(s)"
              >
                <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
              </Button>
            </template>
          </div>
        </div>
      </template>
    </div>

    <p class="text-[11px] leading-relaxed text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      <template v-if="githubActions">
        {{ t("shared.buildSecrets.stagedPrefix") }}
        <span class="font-medium text-foreground/80">{{
          t("shared.buildSecrets.staged")
        }}</span
        >.
        {{ t("shared.buildSecrets.resyncPrefix") }}
        <code class="rounded bg-muted px-1 py-0.5 text-[10px]"
          >LAUNCH_BUILD_&lt;NAME&gt;</code
        >
        {{ t("shared.buildSecrets.resyncSuffix") }}
      </template>
      <template v-else>
        {{ t("shared.buildSecrets.nextBuild") }}
      </template>
    </p>
  </div>
</template>

<style scoped>
.build-secret-add-enter-active,
.build-secret-add-leave-active {
  transition:
    max-height 200ms ease-out,
    opacity 180ms ease-out,
    transform 200ms ease-out;
}

.build-secret-add-enter-from,
.build-secret-add-leave-to {
  max-height: 0;
  opacity: 0;
  transform: translateY(-4px);
}

.build-secret-add-enter-to,
.build-secret-add-leave-from {
  max-height: 24rem;
  opacity: 1;
  transform: translateY(0);
}
</style>
