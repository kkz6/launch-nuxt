<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const emit = defineEmits<{
  updated: [];
}>();

const name = ref(props.compose.name);
const isLoading = ref(false);

watch(
  () => props.compose.name,
  (n) => {
    name.value = n;
  },
);

// Source helpers — only one of these is populated depending on source
// type. Read-only on this page; reconfigure lands in a follow-up.
const sourceCfg = computed(
  () => (props.compose.source_config ?? {}) as Record<string, unknown>,
);
const gitRepo = computed(() => sourceCfg.value.repo as string | undefined);
const gitBranch = computed(() => sourceCfg.value.branch as string | undefined);

const saveSettings = async () => {
  const trimmed = name.value.trim();
  if (!trimmed) {
    toast.error("Stack name is required");
    return;
  }
  isLoading.value = true;
  try {
    await dockerService.composes.update(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      { name: trimmed },
    );
    toast.success("Compose stack updated");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update compose stack");
  } finally {
    isLoading.value = false;
  }
};

</script>

<template>
  <!--
    Mirrors components/server/settings/General.vue: space-y-6 wrapper,
    space-y-4 sections, single Separator before Danger Zone. Source
    info sits as a small read-only dl underneath the form so the user
    can see how the stack is wired without us boxing it in a card.
  -->
  <div class="space-y-6">
    <!-- Stack Information -->
    <div class="space-y-4">
      <div>
        <h3 class="text-lg font-medium">Stack Information</h3>
        <p class="text-sm text-muted-foreground">
          Rename this stack or review where it's deployed from.
        </p>
      </div>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="compose-name">Stack Name</Label>
          <Input
            id="compose-name"
            v-model="name"
            placeholder="e.g. monitoring, db-stack"
            autocomplete="off"
          />
          <p class="text-sm text-muted-foreground">
            Used as the <code>docker-compose</code> project name on
            the host.
          </p>
        </div>

        <Button :disabled="isLoading" @click="saveSettings">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Save Changes
        </Button>
      </div>

      <!--
        Read-only source + runtime data. Lives inside the same section
        so the page stays one logical "everything about this stack"
        column, with destructive-only stuff under the Separator.
      -->
      <dl class="grid gap-3 pt-2 text-sm sm:grid-cols-2">
        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Source Type
          </dt>
          <dd class="font-medium">
            {{
              compose.compose_source_type === "git"
                ? "Git repository"
                : "Inline YAML"
            }}
          </dd>
        </div>

        <div class="space-y-1">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Status
          </dt>
          <dd class="font-medium capitalize">{{ compose.status }}</dd>
        </div>

        <template v-if="compose.compose_source_type === 'git'">
          <div class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Repository
            </dt>
            <dd class="break-all font-mono text-xs">{{ gitRepo || "—" }}</dd>
          </div>
          <div class="space-y-1">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Branch
            </dt>
            <dd class="font-mono text-sm">{{ gitBranch || "—" }}</dd>
          </div>
          <div v-if="compose.compose_file_path" class="space-y-1 sm:col-span-2">
            <dt class="text-xs uppercase tracking-wide text-muted-foreground">
              Compose file
            </dt>
            <dd class="font-mono text-xs">{{ compose.compose_file_path }}</dd>
          </div>
        </template>

        <div class="space-y-1 sm:col-span-2">
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            Last Deployed
          </dt>
          <dd class="font-medium">
            {{
              compose.last_deployed_at
                ? new Date(compose.last_deployed_at).toLocaleString()
                : "Never"
            }}
          </dd>
        </div>

        <div
          v-if="compose.compose_source_type !== 'git' && compose.raw_yaml"
          class="space-y-2 sm:col-span-2"
        >
          <dt class="text-xs uppercase tracking-wide text-muted-foreground">
            docker-compose.yml
          </dt>
          <dd>
            <pre
              class="max-h-72 overflow-auto rounded-md border bg-muted/30 p-3 font-mono text-xs"
              >{{ compose.raw_yaml }}</pre
            >
          </dd>
        </div>
      </dl>
    </div>

    <!--
      Danger zone moved to the Advanced subtab — mirrors the
      application detail page where General is read-only-ish info +
      rename, and Advanced owns destructive operations. Keeps the
      flow consistent across workload types.
    -->
  </div>
</template>
