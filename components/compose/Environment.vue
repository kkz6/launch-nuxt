<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

// Compose Environment surfaces the `.env` file that lives next to the
// compose YAML on the host. The backend persists it on the
// `docker_composes.env_file` column (added in migration 0033) and the
// deploy task writes it to `${STACK_DIR}/.env` right before
// `docker compose up`. Compose then uses it automatically for
// `${VAR}` substitution in the YAML and passes matching keys into
// services that declare them without explicit values.
//
// We chose a single textarea over a structured key/value grid because:
//   * `.env` is a line-oriented format with comments and blank lines
//     that a row-grid would mangle.
//   * The compose YAML's own `environment:` blocks already cover
//     per-service vars when you need fine-grained control. This file
//     is for project-wide values (DOMAIN, NODE_ENV, secrets pulled
//     from the launchctl vault later).
//   * Matches dokploy's UX — operators coming from there hit muscle
//     memory immediately.

const initial = props.compose.env_file ?? "";
const body = ref(initial);
const isSaving = ref(false);

// "Dirty" = current body diverges from what we last successfully
// saved (or from initial load). Drives the disabled state of Save +
// the unsaved-changes hint.
const baseline = ref(initial);
const isDirty = computed(() => body.value !== baseline.value);

const save = async () => {
  isSaving.value = true;
  try {
    await dockerService.composes.update(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      { env_file: body.value },
    );
    baseline.value = body.value;
    toast.success("Environment saved. Redeploy the stack to apply.");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save environment");
  } finally {
    isSaving.value = false;
  }
};

const revert = () => {
  body.value = baseline.value;
};

const lineCount = computed(() => {
  if (!body.value) return 0;
  return body.value.split("\n").length;
});
</script>

<template>
  <div class="space-y-4">
    <!--
      Header strip: title + Save action. Matches the application
      Environment subtab's affordance (Save button right-aligned).
      The unsaved-changes hint is the secondary line beneath the
      title so the user knows what state they're in.
    -->
    <div class="flex items-start justify-between gap-4">
      <div>
        <h3 class="text-lg font-semibold">Environment</h3>
        <p class="text-sm text-muted-foreground">
          Written to <code class="font-mono text-xs">.env</code> next to the
          compose file on each deploy. Compose uses it for
          <code class="font-mono text-xs">${VAR}</code> substitution and
          passes matching keys to services.
          <span v-if="isDirty" class="ml-1 font-medium text-amber-600 dark:text-amber-400">
            Unsaved changes
          </span>
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Button
          v-if="isDirty"
          variant="outline"
          size="sm"
          :disabled="isSaving"
          @click="revert"
        >
          Revert
        </Button>
        <Button :disabled="!isDirty || isSaving" size="sm" @click="save">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:save" class="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>
    </div>

    <!--
      The editor itself. SharedCodeEditor gives line numbers + fold
      gutter; with mono-font + line wrapping disabled the dotenv body
      stays readable for long secrets. We let the textarea grow inside
      a max-height container so very long files don't push the page
      below the fold.
    -->
    <div class="rounded-lg border bg-card">
      <SharedCodeEditor
        v-model="body"
        :line-numbers="true"
        :fold-gutter="false"
        :line-wrapping="false"
        placeholder="# Lines like KEY=value. Comments start with '#'.&#10;# Used by docker compose for ${VAR} substitution.&#10;&#10;DOMAIN=example.com&#10;NODE_ENV=production"
        class="min-h-[360px]"
      />
    </div>

    <!-- Footer meta — line count + redeploy hint. Mirrors the kind of
         small status line the application Advanced tab uses. -->
    <p class="text-xs text-muted-foreground">
      {{ lineCount }} line{{ lineCount === 1 ? "" : "s" }}. Changes apply on
      the next deploy — use the Deploy button on the Deployments subtab to
      push them to the server.
    </p>
  </div>
</template>
