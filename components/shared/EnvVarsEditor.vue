<script setup lang="ts">
import { toast } from "vue-sonner";
import { parseDotEnv } from "~/composables/useDockerHelpers";

/**
 * Generic env-var row. We accept anything that has these four fields
 * so the same editor renders ApplicationEnvVar / ProjectEnvVar /
 * DatabaseEnvVar rows uniformly. The owner-FK field (application_id,
 * project_id, database_id) is opaque to this component.
 */
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
  /**
   * Header copy. Wrappers tend to leave the defaults alone except the
   * project-level editor, which sets a different description to make
   * the `${{project.X}}` flow obvious.
   */
  title?: string;
  description?: string;
  /**
   * Adds a one-line banner above the form explaining the project-ref
   * syntax. Set true on application + database editors; false on the
   * project editor itself (referencing yourself doesn't make sense).
   */
  showProjectHint?: boolean;
  /**
   * Optional replace-all bulk endpoint. When provided, used by the
   * "Replace all" path inside the bulk dialog. When omitted, that
   * path falls back to the loop-create flow against `onCreate`,
   * which still works but isn't transactional.
   */
  onSetBulk?: (rows: CreateData[]) => Promise<EnvVarRow[]>;
  onCreate: (data: CreateData) => Promise<EnvVarRow>;
  onUpdate: (id: string, patch: UpdatePatch) => Promise<EnvVarRow>;
  onDelete: (id: string) => Promise<void>;
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  title: "Environment",
  description: "Env vars passed to the container. Changes take effect on the next deploy.",
  showProjectHint: false,
  onSetBulk: undefined,
});

const emit = defineEmits<{
  /** Fires after every successful create/update/delete/bulk so the
   *  wrapper can sync its `vars` ref. */
  "update:vars": [EnvVarRow[]];
}>();

const isSaving = ref(false);
const showAddForm = ref(false);
const newVar = reactive({ key: "", value: "", is_secret: false });

// Auto-focus the Key input when the add form opens. We watch the
// flag and grab the input through its id — keeps the template free
// of a ref binding just for the focus dance.
const keyInputRef = ref<HTMLInputElement | null>(null);
watch(showAddForm, async (open) => {
  if (!open) return;
  await nextTick();
  // Vue's Input wraps the native element; query through the id we
  // bind below so this stays decoupled from the wrapper component.
  const el = document.getElementById("env-key") as HTMLInputElement | null;
  el?.focus();
  keyInputRef.value = el;
});

const closeAddForm = () => {
  showAddForm.value = false;
  // Reset on close so a partially-filled form doesn't reopen with
  // stale state next time the user clicks Add Var.
  newVar.key = "";
  newVar.value = "";
  newVar.is_secret = false;
};

const bulkOpen = ref(false);
const bulkText = ref("");
// `replace` = wipe-and-replace (only allowed when onSetBulk is wired);
// `append` = loop onCreate, skipping duplicates. Default to append
// because it's the non-destructive choice — the user has to opt into
// the replace radio explicitly.
const bulkMode = ref<"append" | "replace">("append");

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

// Local edit state — only used for inline value edits. Keyed by row
// id so a Cancel on one row doesn't disturb others.
const editing = ref<Record<string, { value: string }>>({});

const startEdit = (v: EnvVarRow) => {
  // Don't pre-fill the masked value into the edit box for secret
  // rows. Empty box = user must explicitly type.
  editing.value[v.id] = { value: v.is_secret ? "" : v.value };
  // Focus the input once the v-if branch swaps in the DOM. Lets the
  // user start typing immediately and adds an Esc-to-cancel handler
  // via the input's keyboard binding below.
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
  try {
    const updated = await props.onUpdate(v.id, { value: next.value });
    syncRow(updated);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update env var");
    return;
  }
  cancelEdit(v.id);
};

const addVar = async () => {
  const key = newVar.key.trim();
  if (!key) {
    toast.error("Key is required");
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
    // closeAddForm resets newVar AND hides the form so the next
    // open is a clean slate.
    closeAddForm();
    toast.success("Env var added");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add env var");
  } finally {
    isSaving.value = false;
  }
};

const toggleSecret = async (v: EnvVarRow) => {
  try {
    const updated = await props.onUpdate(v.id, { is_secret: !v.is_secret });
    syncRow(updated);
    // Confirm the change so the user knows the silent toggle actually
    // wrote to the server. Without this the row just visually flips
    // and it's not clear whether the click landed.
    toast.success(
      updated.is_secret
        ? `${v.key} is now masked`
        : `${v.key} is no longer masked`,
    );
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update env var");
  }
};

const removeVar = async (v: EnvVarRow) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove Env Var",
    description: `Remove ${v.key}?`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await props.onDelete(v.id);
    emit("update:vars", props.vars.filter((x) => x.id !== v.id));
    toast.success("Env var removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove env var");
  }
};

// Parse + validate the bulk text once. Returns the rows + a count of
// duplicates against the current set so the submit handler can warn
// the user before clobbering anything.
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
    toast.error("No valid KEY=VALUE lines found");
    return;
  }

  if (bulkMode.value === "replace") {
    // Replace-all is only safe when the wrapper provided a real
    // transactional bulk endpoint. Without it we'd have to delete +
    // create N times client-side, which can leave the table in a
    // half-applied state on failure. Block here and tell the user
    // to switch to append.
    if (!props.onSetBulk) {
      toast.error("Replace-all isn't supported here. Use Append.");
      return;
    }
    if (!confirmationDialog.value) return;
    const result = await confirmationDialog.value.show({
      title: "Replace env vars",
      description: `This replaces ALL ${props.vars.length} existing env var(s) with ${rows.length} new one(s). Sure?`,
      confirmText: "Replace",
      cancelText: "Cancel",
      destructive: true,
    });
    if (!result.ok) return;
    isSaving.value = true;
    try {
      const next = await props.onSetBulk(rows);
      emit("update:vars", sortVars(next));
      bulkOpen.value = false;
      bulkText.value = "";
      toast.success(`Saved ${next.length} env var(s)`);
    } catch (err: unknown) {
      const e = err as { data?: { message?: string } };
      toast.error(e.data?.message || "Failed to save env vars");
    } finally {
      isSaving.value = false;
    }
    return;
  }

  // Append path — loop onCreate, skipping rows whose key is already
  // present (so paste-from-another-project doesn't blow up on the
  // first dup). Each create is independent; if some fail the
  // partial state is honest — every created row is already in the
  // table.
  const existingKeys = new Set(props.vars.map((v) => v.key));
  const toAdd = rows.filter((r) => !existingKeys.has(r.key));
  if (toAdd.length === 0) {
    toast.error(`All ${rows.length} key(s) already exist`);
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
      errs.push(`${row.key}: ${e.data?.message || "failed"}`);
    }
  }
  emit("update:vars", sortVars([...props.vars, ...newRows]));
  if (created > 0) {
    const skipped = duplicates > 0 ? ` (skipped ${duplicates} duplicate)` : "";
    toast.success(`Added ${created} env var(s)${skipped}`);
  }
  if (errs.length > 0) {
    toast.error(`${errs.length} failed: ${errs.slice(0, 3).join("; ")}`);
  }
  if (errs.length === 0) {
    bulkOpen.value = false;
    bulkText.value = "";
  }
  isSaving.value = false;
};

// Smart-paste on the inline single-row Key input. If the user pastes
// multiline KEY=VALUE pairs (e.g. from another project's .env), we
// detect it and route straight to the bulk dialog with the pasted
// text pre-filled — so the user doesn't have to discover the bulk
// button to do the obvious thing.
const onKeyPaste = (event: ClipboardEvent) => {
  const text = event.clipboardData?.getData("text") ?? "";
  if (!text.includes("\n") && !text.includes("=")) return;
  // Only intercept when we can actually parse 2+ rows out. Single
  // KEY=VALUE on one line is fine to let the user type into the
  // current form; a multi-line .env is what triggers the redirect.
  const parsed = parseDotEnv(text);
  if (parsed.length < 2) return;
  event.preventDefault();
  bulkText.value = text;
  bulkMode.value = "append";
  bulkOpen.value = true;
  // Close the inline add form — the bulk dialog is taking over.
  closeAddForm();
};

// Helper: replace a row by id in the parent's vars list, preserving
// order, and emit. Used by saveEdit + toggleSecret.
const syncRow = (updated: EnvVarRow) => {
  emit(
    "update:vars",
    props.vars.map((x) => (x.id === updated.id ? updated : x)),
  );
};

const sortVars = (vars: EnvVarRow[]) =>
  [...vars].sort((a, b) => a.key.localeCompare(b.key));
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <h2 class="text-base font-semibold">{{ title }}</h2>
        <p class="text-xs text-muted-foreground">{{ description }}</p>
      </div>
      <div class="flex shrink-0 gap-2">
        <!--
          Bulk-add button — always available. Opens a dialog the user
          can paste a whole `.env`-style block into. Works on every
          editor (project / database / application) regardless of
          whether the wrapper provides a transactional setBulk: the
          dialog's "Append" mode loops onCreate, which every editor
          has. Wrappers with a real setBulk also get a "Replace all"
          radio inside the dialog.
        -->
        <Button
          size="icon-sm"
          variant="outline"
          title="Add multiple (paste .env)"
          aria-label="Add multiple env vars from a .env-style paste"
          @click="openBulkDialog"
        >
          <Icon name="lucide:clipboard-paste" class="h-4 w-4" />
        </Button>

        <!--
          Single-row add toggle: same `+` glyph rotates 45° on open
          so it reads as `×` when expanded. Tooltip surfaces the
          state-specific verb for hover and screen readers.
        -->
        <Button
          size="icon-sm"
          :variant="showAddForm ? 'outline' : 'default'"
          :title="showAddForm ? 'Close' : 'Add var'"
          :aria-label="showAddForm ? 'Close' : 'Add var'"
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

    <!--
      Project-ref hint banner. Only shown on container-level editors
      (application + database) where the project-reference syntax
      resolves at deploy/run time. The project editor itself sets
      this to false — a project env var can't reference itself.

      v-pre on the <code> tells Vue's template compiler to leave the
      mustache-shaped string `${{project.KEY}}` literal instead of
      trying to compile it as a Vue interpolation (which would fail
      with "Unterminated string constant" — the inner `{` opens what
      Vue thinks is a JS object literal).
    -->
    <div
      v-if="showProjectHint"
      class="flex items-start gap-2 rounded-md border border-sky-500/30 bg-sky-500/5 px-3 py-2 text-xs text-sky-700 dark:text-sky-300"
    >
      <Icon name="lucide:lightbulb" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        Reference a project env var with
        <code
          v-pre
          class="rounded bg-sky-500/15 px-1 py-0.5 text-[11px]"
        >${{project.KEY}}</code>
        — resolved at deploy / run time.
      </p>
    </div>

    <!--
      Add-var inline form, animated.

      <Transition> with the `env-add-form` name pair drives the
      collapse/expand. CSS lives at the bottom of this file:
        - enter: opacity 0 → 1 + max-height 0 → 24rem + translate-y-1 → 0
        - leave: reverse
      ~180ms ease-out — quick enough to feel snappy, slow enough
      that the user follows where focus is going.

      Visual: muted background + a visible 4px sky-tinted left bar
      matches the project-ref hint banner above, so the new surface
      reads as "form action". `border` on its own renders too pale
      against `bg-card` (light theme primary is near-black, so the
      original `border-l-primary/60` came out muddy grey). Submitting
      on Enter (`form @submit.prevent`) keeps keyboard flow tight.
    -->
    <Transition name="env-add-form">
      <form
        v-if="showAddForm"
        class="space-y-3 overflow-hidden rounded-lg border border-sky-500/30 border-l-[3px] border-l-sky-500/70 bg-muted/30 p-4 shadow-sm"
        @submit.prevent="addVar"
      >
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="env-key" class="text-xs">Key</Label>
            <!--
              @paste with smart-detection: if the clipboard holds 2+
              KEY=VALUE lines (e.g. `cat .env | pbcopy`), redirect
              into the bulk dialog instead of letting the user paste
              a 600-char string into the Key field. Single-line
              pastes go through normally so DATABASE_URL=... still
              works when you've copied just one row.
            -->
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
            <Label for="env-value" class="text-xs">Value</Label>
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
            Treat as secret (mask in list)
          </label>
          <div class="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              :disabled="isSaving"
              @click="closeAddForm"
            >
              Cancel
            </Button>
            <Button type="submit" size="sm" :disabled="isSaving">
              <Icon
                v-if="isSaving"
                name="lucide:loader-2"
                class="mr-2 h-3.5 w-3.5 animate-spin"
              />
              Add
            </Button>
          </div>
        </div>
      </form>
    </Transition>

    <div v-if="loading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
    </div>

    <SharedEmptyState
      v-else-if="vars.length === 0"
      icon="lucide:key"
      title="No env vars yet"
      :description="
        showProjectHint
          ? 'Add per-container config like DATABASE_URL or NODE_ENV. Already have a .env file? Use Paste .env above.'
          : 'Add shared config that any workload under this project can reference via ${{project.KEY}}.'
      "
    />

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          <tr>
            <th class="px-4 py-2">Key</th>
            <th class="px-4 py-2">Value</th>
            <th class="w-32 px-4 py-2" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="v in vars" :key="v.id" class="border-t">
            <td class="px-4 py-2 align-top font-mono text-xs">
              {{ v.key }}
              <span
                v-if="v.is_secret"
                class="ml-2 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400"
              >
                secret
              </span>
            </td>
            <td class="px-4 py-2 align-top">
              <!--
                Inline edit: constrain the input width so an edit on
                a wide screen doesn't sprawl across the whole row.
                max-w-md is roughly what a typical env value needs;
                long values still wrap when displayed in read mode.
              -->
              <div v-if="editing[v.id]" class="flex max-w-md items-center gap-2">
                <Input
                  :id="`env-edit-${v.id}`"
                  v-model="editing[v.id].value"
                  :type="v.is_secret ? 'password' : 'text'"
                  class="h-8 flex-1 font-mono text-xs"
                  autocomplete="off"
                  spellcheck="false"
                  @keyup.enter="saveEdit(v)"
                  @keyup.esc="cancelEdit(v.id)"
                />
                <Button size="sm" @click="saveEdit(v)">Save</Button>
                <Button
                  size="sm"
                  variant="ghost"
                  @click="cancelEdit(v.id)"
                >
                  Cancel
                </Button>
              </div>
              <!--
                Read mode: hover-only edit-pencil so the button looks
                like a real interactive thing instead of plain text.
                rounded box on hover gives a subtle hit indicator.
              -->
              <button
                v-else
                :title="v.is_secret ? 'Click to replace (secret)' : 'Click to edit'"
                class="group/value -mx-2 flex w-full max-w-full items-center gap-2 rounded px-2 py-1 text-left transition-colors hover:bg-muted"
                @click="startEdit(v)"
              >
                <span class="truncate font-mono text-xs text-muted-foreground group-hover/value:text-foreground">
                  {{ v.value || "(empty)" }}
                </span>
                <Icon
                  name="lucide:pencil"
                  class="ml-auto h-3 w-3 shrink-0 text-muted-foreground/0 transition-opacity group-hover/value:text-muted-foreground"
                />
              </button>
            </td>
            <td class="w-24 px-2 py-2 text-right align-top">
              <!--
                Row actions hidden while the row is being edited —
                otherwise eye / trash sit next to Save / Cancel and
                the user can't tell which set governs the inline
                input. group-hover keeps the buttons subtle when
                idle; tooltips spell out the state-specific verb.
              -->
              <div v-if="!editing[v.id]" class="flex justify-end gap-0.5">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  :title="v.is_secret ? 'Stop masking this value' : 'Mask this value'"
                  :aria-label="v.is_secret ? 'Stop masking' : 'Mask value'"
                  @click="toggleSecret(v)"
                >
                  <Icon
                    :name="v.is_secret ? 'lucide:eye-off' : 'lucide:eye'"
                    class="h-3.5 w-3.5"
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  title="Remove env var"
                  aria-label="Remove env var"
                  class="text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  @click="removeVar(v)"
                >
                  <Icon name="lucide:trash-2" class="h-3.5 w-3.5" />
                </Button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-[11px] text-muted-foreground">
      <Icon name="lucide:info" class="-mt-0.5 mr-1 inline-block h-3 w-3" />
      Changes don't update the running container until you redeploy / restart.
    </p>

    <!--
      Bulk-add dialog. Always available now (previously only when
      onSetBulk was wired) — the "Append" mode loops onCreate which
      every editor has. "Replace all" radio is rendered only when
      the wrapper passed onSetBulk so the destructive option is
      gated on a transactional endpoint behind it.

      Parsed-row preview gives the user a sanity check before
      submitting: "found 5 entries, 2 will be skipped (duplicates)".
    -->
    <Dialog v-model:open="bulkOpen">
      <DialogContent class="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle class="text-base">Add multiple env vars</DialogTitle>
          <DialogDescription class="text-xs">
            Paste a <code>.env</code>-style block. Comments
            (<code>#</code>) and blank lines are skipped;
            <code>export FOO=bar</code> prefixes are tolerated.
          </DialogDescription>
        </DialogHeader>

        <!--
          SharedCodeEditor (CodeMirror) instead of a plain textarea:
            - line numbers help the user count entries at a glance
            - monospace + github theme make `.env` syntax read
              cleanly (light/dark mode swap is handled inside the
              editor)
            - paste behaviour respects newlines and tabs verbatim,
              which the textarea sometimes mangled
          foldGutter is off (.env files don't have folds), line
          wrapping is on so a long DATABASE_URL doesn't disappear
          to the right.
        -->
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

        <!--
          Inline parse summary — fires off the bulkText every render.
          Hidden until the textarea has content so the empty state
          stays uncluttered.
        -->
        <div
          v-if="bulkText.trim().length > 0"
          class="rounded-md border bg-muted/30 px-3 py-2 text-xs"
        >
          <div class="flex items-center gap-2">
            <Icon
              :name="parsedBulk.rows.length > 0 ? 'lucide:check-circle-2' : 'lucide:alert-circle'"
              :class="[
                'h-3.5 w-3.5',
                parsedBulk.rows.length > 0
                  ? 'text-emerald-600'
                  : 'text-amber-600',
              ]"
            />
            <span>
              Found
              <strong>{{ parsedBulk.rows.length }}</strong>
              valid entr{{ parsedBulk.rows.length === 1 ? "y" : "ies" }}
              <template v-if="parsedBulk.duplicates > 0">
                · <strong>{{ parsedBulk.duplicates }}</strong>
                will be skipped (duplicate of an existing key)
              </template>
            </span>
          </div>
        </div>

        <!--
          Mode picker. Append is the safe default; Replace is only
          offered when the wrapper provided a transactional setBulk
          (currently just application). Project + database editors
          loop onCreate and so don't expose Replace.
        -->
        <div v-if="onSetBulk" class="space-y-2">
          <Label class="text-xs">When applying</Label>
          <div class="flex gap-4">
            <label class="flex cursor-pointer items-center gap-2 text-xs">
              <input
                v-model="bulkMode"
                type="radio"
                value="append"
                class="h-3.5 w-3.5 accent-primary"
              />
              Append (skip duplicates)
            </label>
            <label class="flex cursor-pointer items-center gap-2 text-xs">
              <input
                v-model="bulkMode"
                type="radio"
                value="replace"
                class="h-3.5 w-3.5 accent-primary"
              />
              Replace all
              <span class="text-[10px] text-muted-foreground">
                (destructive)
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
            Cancel
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
            {{ bulkMode === "replace" ? "Replace all" : "Add" }}
            {{ parsedBulk.rows.length > 0 ? `(${parsedBulk.rows.length})` : "" }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>

<style scoped>
/*
  env-add-form: slide-down + fade for the inline Add Var form. The
  max-height trick gives a smooth collapse without requiring a fixed
  height — `24rem` is a hair more than the rendered form so the
  collapse always reaches the layout target before clipping. Keeps
  the wrapper `overflow-hidden` so half-rendered children don't
  bleed during the transition.
*/
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
