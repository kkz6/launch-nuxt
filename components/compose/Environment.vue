<script setup lang="ts">
import { parseDotEnv } from "~/composables/useDockerHelpers";
import { dockerService, type DockerCompose } from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const { t } = useI18n();

// Compose Environment uses the same SharedEnvVarsEditor as
// application + database + project Environment so the UX is one
// learnable surface across every workload type. The backend storage
// is different (compose persists a single `env_file` LONGTEXT blob,
// not per-row rows) but we hide that here by:
//
//   1. Parsing compose.env_file into virtual rows on load. Each row
//      gets a synthetic id (`row-N`) so the editor's keyed v-for +
//      single-row update calls have something stable to target.
//   2. Re-serializing the rows back to a KEY=VALUE\n body on every
//      mutation and saving the whole body via PATCH /composes/:id.
//
// Trade-off: comments and blank lines in the existing .env body are
// dropped on the first save. Acceptable for the structured-editor
// UX; power users who need to preserve comments can still hand-edit
// via the Advanced subtab or a raw-mode toggle we add later.

interface VirtualRow {
  id: string;
  key: string;
  value: string;
  is_secret: boolean;
}

const vars = ref<VirtualRow[]>([]);
const isLoading = ref(false);

// Synthetic-id factory — increments per parse so every row has a
// unique key for v-for + so update/delete calls can find the right
// row by id even after re-parses.
let rowCounter = 0;
const nextId = () => `row-${++rowCounter}`;

const hydrate = (envFile: string | null | undefined) => {
  const parsed = parseDotEnv(envFile ?? "");
  vars.value = parsed.map((p) => ({
    id: nextId(),
    key: p.key,
    value: p.value,
    is_secret: false,
  }));
};

hydrate(props.compose.env_file);

// Re-hydrate when the parent passes in a fresh compose row (e.g.
// after a successful save the page may refetch). Keeps the editor
// in sync with the canonical server copy.
watch(
  () => props.compose.env_file,
  (next, prev) => {
    if (next === prev) return;
    hydrate(next);
  },
);

// Compose values may interpolate ${...} but NOT the project-ref
// `${{project.X}}` syntax that application + database env vars
// support — docker compose's own variable substitution doesn't know
// about that wrapper. So we leave the project hint off here to
// avoid implying it works.

// Serialise virtual rows back to a .env body for the PATCH. We quote
// values that contain whitespace, `=`, `"`, or `'` so docker compose
// parses them back the same way. Other values are emitted bare.
const serialize = (rows: VirtualRow[]): string => {
  const needsQuoting = /[\s='"]/;
  return rows
    .map((r) => {
      const value = needsQuoting.test(r.value)
        ? `"${r.value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        : r.value;
      return `${r.key}=${value}`;
    })
    .join("\n");
};

const persist = async (rows: VirtualRow[]) => {
  const body = serialize(rows);
  await dockerService.composes.update(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    { env_file: body },
  );
};

// Editor callbacks. The SharedEnvVarsEditor expects per-row CRUD
// promises that return a server row. We satisfy that contract from
// the virtual-rows side: mutate locally, persist the whole body,
// return the mutated row.
const onCreate = async (data: {
  key: string;
  value: string;
  is_secret?: boolean;
}) => {
  const row: VirtualRow = {
    id: nextId(),
    key: data.key,
    value: data.value,
    is_secret: !!data.is_secret,
  };
  const next = [...vars.value, row];
  await persist(next);
  vars.value = next;
  return row;
};

const onUpdate = async (
  id: string,
  patch: { value?: string; is_secret?: boolean },
) => {
  const idx = vars.value.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error(t("workload.environment.rowMissing"));
  }
  const updated: VirtualRow = {
    ...vars.value[idx],
    value: patch.value ?? vars.value[idx].value,
    is_secret: patch.is_secret ?? vars.value[idx].is_secret,
  };
  const next = vars.value.slice();
  next[idx] = updated;
  await persist(next);
  vars.value = next;
  return updated;
};

const onDelete = async (id: string) => {
  const next = vars.value.filter((r) => r.id !== id);
  await persist(next);
  vars.value = next;
};

const onSetBulk = async (
  rows: { key: string; value: string; is_secret?: boolean }[],
) => {
  const next: VirtualRow[] = rows.map((r) => ({
    id: nextId(),
    key: r.key,
    value: r.value,
    is_secret: !!r.is_secret,
  }));
  await persist(next);
  vars.value = next;
  return next;
};

const onRestart = async () => {
  await dockerService.composes.reload(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
  );
};
</script>

<template>
  <!--
    SharedEnvVarsEditor is the same component application / database /
    project Environment use. We pass the same prop shape so the chrome
    (title + subtitle + Add / Copy buttons + empty state + replace-
    all dialog) is byte-identical with the other workload Environment
    pages. The compose-specific subtitle clarifies the deploy timing.
  -->
  <SharedEnvVarsEditor
    :vars="vars"
    :loading="isLoading"
    :is-running="compose.status === 'running'"
    :on-restart="onRestart"
    :restart-label="t('workload.actions.reload')"
    :title="t('workload.environment.title')"
    :description="t('workload.environment.composeDescription')"
    :empty-description="t('workload.environment.composeEmptyDescription')"
    :on-create="onCreate"
    :on-update="onUpdate"
    :on-delete="onDelete"
    :on-set-bulk="onSetBulk"
  />
</template>
