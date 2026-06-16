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
   * project editor itself (referencing yourself doesn't make sense)
   * AND on compose (whose env_file is plain dotenv with no
   * `${{project.KEY}}` substitution support).
   */
  showProjectHint?: boolean;
  /**
   * Optional override for the empty-state body copy. The default
   * branches on showProjectHint (per-container hint vs project-share
   * hint); compose wants its own wording because the default false
   * branch implies project-scope which is wrong for a single stack.
   */
  emptyDescription?: string;
  isRunning?: boolean;
  onRestart?: () => Promise<void>;
  restartLabel?: string;
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
  isRunning: false,
  onRestart: undefined,
  restartLabel: "Restart",
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
// id so a Cancel on one row doesn't disturb others. Carries both the
// value-in-progress AND the working `is_secret` flag so the user can
// flip the mask-by-default toggle as part of the same Save.
const editing = ref<
  Record<string, { value: string; isSecret: boolean }>
>({});

// Client-side reveal state. Lets the user see a secret value
// temporarily WITHOUT changing the persistent `is_secret` flag on
// the row. Previously the only way to see a secret was to flip
// is_secret off — which was both noisy (other team members saw the
// row un-mask permanently) and confusing (the eye icon called
// `onUpdate({ is_secret: false })` even though it looked like a
// view-only toggle).
//
// Reset implicitly by being keyed on row id — if a row is deleted or
// its id changes, the stale entry becomes inert. We don't proactively
// prune to keep this simple.
const revealed = ref<Record<string, boolean>>({});

const toggleReveal = (v: EnvVarRow) => {
  revealed.value = {
    ...revealed.value,
    [v.id]: !revealed.value[v.id],
  };
};

const startEdit = (v: EnvVarRow) => {
  // Don't pre-fill the masked value into the edit box for secret
  // rows that haven't been revealed. For revealed secrets (user
  // already proved they can see it) and plain rows, pre-fill so
  // they can tweak without retyping the whole thing.
  const prefill = v.is_secret && !revealed.value[v.id] ? "" : v.value;
  editing.value[v.id] = {
    value: prefill,
    isSecret: v.is_secret,
  };
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
  // Build the patch lazily so we only send fields that ACTUALLY
  // changed. Keeps the API audit log clean and avoids overwriting a
  // value with an empty string on a "I just want to flip the secret
  // flag" save — we treat blank input as "no value change" when the
  // row is secret + un-revealed (the user couldn't see it anyway).
  const patch: UpdatePatch = {};
  const userTypedValue = next.value !== "" || (!v.is_secret || !!revealed.value[v.id]);
  if (userTypedValue && next.value !== v.value) {
    patch.value = next.value;
  }
  if (next.isSecret !== v.is_secret) {
    patch.is_secret = next.isSecret;
  }
  if (Object.keys(patch).length === 0) {
    // Nothing to save — just close the editor.
    cancelEdit(v.id);
    return;
  }
  try {
    const updated = await props.onUpdate(v.id, patch);
    syncRow(updated);
    // If the user flipped the row to non-secret as part of the save,
    // clear any stale reveal-state for it. Mostly cosmetic — the
    // template hides the eye when !is_secret anyway.
    if (!updated.is_secret) {
      delete revealed.value[v.id];
      revealed.value = { ...revealed.value };
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update env var");
    return;
  }
  cancelEdit(v.id);
  await promptRestart();
};

const copyValue = async (v: EnvVarRow) => {
  if (!v.value) {
    toast.error("Nothing to copy");
    return;
  }
  try {
    await navigator.clipboard.writeText(v.value);
    toast.success(`${v.key} copied`);
  } catch {
    toast.error("Clipboard write failed");
  }
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
    return;
  } finally {
    isSaving.value = false;
  }
  await promptRestart();
};

// Persistent is_secret toggle. Fires on chip click (the "secret" /
// "not secret" badge next to the key) and on edit-form checkbox
// changes — NOT on the row-action eye, which is now a client-side
// reveal toggle. Splitting reveal (view-only) from is_secret (DB
// state) was the core fix for the "marking secret still shows the
// value" bug: previously the eye was conflated with is_secret, so
// a user toggling visibility was unknowingly mutating server state.
const toggleSecret = async (v: EnvVarRow) => {
  try {
    const updated = await props.onUpdate(v.id, { is_secret: !v.is_secret });
    syncRow(updated);
    // If we just MARKED a row secret, drop any stale reveal entry so
    // the value is actually hidden on the next render.
    if (updated.is_secret) {
      delete revealed.value[v.id];
      revealed.value = { ...revealed.value };
    }
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
    return;
  }
  await promptRestart();
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
      return;
    } finally {
      isSaving.value = false;
    }
    await promptRestart();
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
  if (created > 0) {
    await promptRestart();
  }
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

const isRestarting = ref(false);

// After a successful env mutation, offer to restart/reload if the workload is running.
const promptRestart = async () => {
  if (!props.isRunning || !props.onRestart || !confirmationDialog.value) return;

  const label = props.restartLabel || "Restart";
  const result = await confirmationDialog.value.show({
    title: `${label} to apply changes?`,
    description: `Environment variables saved. The running container is still using the old values — ${label.toLowerCase()} it to pick up the changes?`,
    confirmText: label,
    cancelText: "Not now",
  });

  if (!result.ok) return;

  isRestarting.value = true;
  try {
    await props.onRestart();
    toast.success(`${label} triggered — new env will be active shortly`);
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || `Failed to ${label.toLowerCase()}`);
  } finally {
    isRestarting.value = false;
  }
};

// Resolved empty-state description. Computed in script (not inlined in a
// `{{ }}` mustache) because the default copy contains the literal
// `${{project.KEY}}` token, and Vue's mustache parser treats the inner
// `{{` as a new interpolation opener — yields "Unterminated string
// constant". Building the string in JS keeps the dollar-double-brace
// literal away from the template tokenizer.
const resolvedEmptyDescription = computed(() => {
  if (props.emptyDescription) return props.emptyDescription;
  return props.showProjectHint
    ? "Add per-container config like DATABASE_URL or NODE_ENV. Already have a .env file? Use Paste .env above."
    : "Add shared config that any workload under this project can reference via ${{project.KEY}}.";
});
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0 space-y-1">
        <div class="flex items-center gap-2">
          <h2 class="text-base font-semibold">{{ title }}</h2>
          <!--
            Encryption reassurance chip. Surfaces what's already true:
            values are AES-256-GCM encrypted in our DB via
            internal/pkg/dbtype/encrypted.go. The same chip is shown on
            every editor (project / application / database) because the
            same dbtype wraps all three models. Tooltip carries the
            longer-form explanation so the header stays compact.
          -->
          <span
            class="inline-flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400"
            title="Values are encrypted at rest with AES-256-GCM in the Launch database. They reach the container at deploy time via a 0600 env file on the host (tmpfs) — never as cleartext command-line args."
          >
            <Icon name="lucide:shield-check" class="h-3 w-3" />
            Encrypted at rest
          </span>
        </div>
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
      Runtime-vs-build clarification. These env vars are passed to
      `docker run` via --env-file at deploy time. They are NOT
      available during `docker build` — a Dockerfile that needs a
      credential for an install step (private npm/pip/composer registry,
      private git clone in a multi-stage build, etc.) needs a separate
      build-time secret. This banner shows on every editor variant so
      a user landing on Environment doesn't assume runtime values flow
      backwards into the build.
    -->
    <div
      class="flex items-start gap-2 rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-800 dark:text-amber-300"
    >
      <Icon name="lucide:info" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <p>
        Values here are passed to <span class="font-mono">docker run</span>
        only — they're <strong>not available during build</strong>.
        For credentials a <span class="font-mono">RUN</span> step needs
        at build time, use Build-time secrets on the GitHub Actions tab.
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

    <!--
      Rows render as CSS-grid containers (NOT a <table>) so column
      widths stay LOCKED regardless of whether a row is in read or
      edit mode. The old <table> implementation let the value cell
      absorb Save/Cancel buttons in edit mode, which shifted the
      adjacent actions cell to an empty 96px stripe — the visible
      "alignment issue" the user reported.

      Three tracks:
        [key | value | actions]
         220px  1fr   168px

      Same widths in read AND edit modes; only what FILLS each
      track changes.

      Loader + empty state branch INSIDE this single bordered card so
      we don't end up with two stacked card-like surfaces (the bug
      the user spotted in the screenshot: an empty-state pane visible
      above a still-rendered "KEY / VALUE / ACTIONS" header strip
      with no rows underneath).
    -->
    <div class="overflow-hidden rounded-lg border">
      <!-- Loading: centered spinner, no header strip yet. -->
      <div v-if="loading" class="flex items-center justify-center py-16">
        <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin text-muted-foreground" />
      </div>

      <!--
        Empty: inline state inside the card. We DON'T use
        SharedEmptyState here because that component renders its own
        dashed border + muted background — putting it inside this
        solid-bordered card visually duplicated the surface (the
        original screenshot bug). The inline version is visually
        flatter and reads as "this card is empty" rather than "an
        empty pane next to a separate card".
      -->
      <div
        v-else-if="vars.length === 0"
        class="flex flex-col items-center justify-center px-6 py-12 text-center"
      >
        <div class="flex h-11 w-11 items-center justify-center rounded-lg border border-border/40 bg-muted/30">
          <Icon name="lucide:key" class="h-5 w-5 text-muted-foreground/70" />
        </div>
        <h3 class="mt-3 text-sm font-medium text-foreground/80">No env vars yet</h3>
        <p class="mt-1 max-w-md text-xs text-muted-foreground/80">
          {{ resolvedEmptyDescription }}
        </p>
      </div>

      <!--
        Has rows: header strip + one row per env var. Header is only
        rendered in this branch so the empty + loading states above
        don't get a dangling column-label bar.
      -->
      <template v-else>
        <!-- Header row uses the same grid so column boundaries line up
             with the data rows below regardless of zoom or font scale. -->
        <div
          class="grid grid-cols-[220px_1fr_168px] gap-2 border-b bg-muted/50 px-4 py-2 text-[10px] uppercase tracking-wide text-muted-foreground"
        >
          <div>Key</div>
          <div>Value</div>
          <div class="text-right">Actions</div>
        </div>

        <div
          v-for="v in vars"
          :key="v.id"
          class="grid grid-cols-[220px_1fr_168px] items-center gap-2 border-b px-4 py-2 last:border-b-0"
        >
        <!-- KEY column. Truncates long keys with overflow-hidden +
             title so the row never widens past 220px. The secret
             chip is a small click-target: clicking it flips
             is_secret on the server. Mouse hint says so. -->
        <div class="flex min-w-0 items-center gap-1.5">
          <code
            class="truncate font-mono text-xs"
            :title="v.key"
          >
            {{ v.key }}
          </code>
          <button
            type="button"
            class="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors"
            :class="
              v.is_secret
                ? 'bg-amber-500/15 text-amber-700 hover:bg-amber-500/25 dark:text-amber-400'
                : 'bg-muted text-muted-foreground hover:bg-muted/70'
            "
            :title="
              v.is_secret
                ? 'Click to stop masking this value (it will be visible to your team)'
                : 'Click to mask this value (treat as secret)'
            "
            @click="toggleSecret(v)"
          >
            {{ v.is_secret ? "secret" : "plain" }}
          </button>
        </div>

        <!-- VALUE column. Two branches:
               - editing[v.id] truthy → Input + (optional) inline
                 "treat as secret" checkbox below
               - otherwise         → masked dots OR raw value, with a
                                     ghost-pencil hover indicator -->
        <div class="min-w-0">
          <!-- Edit mode -->
          <div v-if="editing[v.id]" class="space-y-1.5">
            <Input
              :id="`env-edit-${v.id}`"
              v-model="editing[v.id].value"
              :type="editing[v.id].isSecret && !revealed[v.id] ? 'password' : 'text'"
              class="h-9 w-full font-mono text-xs"
              :placeholder="v.is_secret && !revealed[v.id] ? '(leave blank to keep current)' : ''"
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
              Treat as secret (mask in list)
            </label>
          </div>

          <!-- Read mode -->
          <button
            v-else
            type="button"
            :title="v.is_secret && !revealed[v.id] ? 'Click to edit (value hidden)' : 'Click to edit'"
            class="group/value -mx-1 flex w-full max-w-full items-center gap-1.5 rounded px-1 py-1 text-left transition-colors hover:bg-muted/60"
            @click="startEdit(v)"
          >
            <span
              v-if="v.is_secret && !revealed[v.id]"
              class="select-none truncate font-mono text-xs tracking-widest text-muted-foreground"
              aria-label="Value hidden"
            >
              ••••••••
            </span>
            <span
              v-else
              class="truncate font-mono text-xs text-muted-foreground group-hover/value:text-foreground"
            >
              {{ v.value || "(empty)" }}
            </span>
            <Icon
              name="lucide:pencil"
              class="ml-auto h-3 w-3 shrink-0 text-muted-foreground/0 transition-opacity group-hover/value:text-muted-foreground"
            />
          </button>
        </div>

        <!-- ACTIONS column — fixed width, right-aligned. The
             two-mode swap below preserves column width so the row
             doesn't jitter when toggling edit. All buttons use
             `icon-sm` (h-9) so they vertically match the h-9 input
             in edit mode (fixes the "buttons stick out below the
             input" alignment regression). -->
        <div class="flex justify-end gap-0.5">
          <!-- Edit mode: just Save + Cancel. icon-only keeps the
               column the same width as the read-mode toolbar. -->
          <template v-if="editing[v.id]">
            <Button
              variant="default"
              size="icon-sm"
              title="Save changes"
              aria-label="Save changes"
              @click="saveEdit(v)"
            >
              <Icon name="lucide:check" class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Cancel edit"
              aria-label="Cancel edit"
              @click="cancelEdit(v.id)"
            >
              <Icon name="lucide:x" class="h-3.5 w-3.5" />
            </Button>
          </template>

          <!-- Read mode toolbar: Reveal (secrets only) | Copy | Edit
               | Delete. Up to 4 icons; for non-secret rows the eye
               is dropped (no value is hidden). All ghost variant so
               the row reads calmly when idle. -->
          <template v-else>
            <Button
              v-if="v.is_secret"
              variant="ghost"
              size="icon-sm"
              :title="revealed[v.id] ? 'Hide value' : 'Reveal value'"
              :aria-label="revealed[v.id] ? 'Hide value' : 'Reveal value'"
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
              title="Copy value"
              aria-label="Copy value"
              :disabled="!v.value"
              @click="copyValue(v)"
            >
              <Icon name="lucide:copy" class="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Edit"
              aria-label="Edit"
              @click="startEdit(v)"
            >
              <Icon name="lucide:pencil" class="h-3.5 w-3.5" />
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
          </template>
        </div>
        </div>
      </template>
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
