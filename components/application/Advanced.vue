<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const emit = defineEmits<{ updated: [] }>();

// Initial values come from build_config — we read defensively because
// the field might not be present on apps created before phase 4b.
const cfg = computed(
  () => (props.application.build_config ?? {}) as Record<string, unknown>,
);

const form = reactive({
  cpu_limit: (cfg.value.cpu_limit as string) ?? "",
  memory_limit: (cfg.value.memory_limit as string) ?? "",
  restart_policy:
    ((cfg.value.restart_policy as string) || "unless-stopped") as
      | "no"
      | "on-failure"
      | "always"
      | "unless-stopped",
  healthcheck_command: (cfg.value.healthcheck_command as string) ?? "",
  extra_ports_raw: Array.isArray(cfg.value.extra_ports)
    ? (cfg.value.extra_ports as string[]).join("\n")
    : "",
});

const isSaving = ref(false);

// Re-seed when the parent refetches the application (e.g. after a
// successful save).
watch(
  () => props.application.build_config,
  (b) => {
    const x = (b ?? {}) as Record<string, unknown>;
    form.cpu_limit = (x.cpu_limit as string) ?? "";
    form.memory_limit = (x.memory_limit as string) ?? "";
    form.restart_policy =
      ((x.restart_policy as string) || "unless-stopped") as
        | "no"
        | "on-failure"
        | "always"
        | "unless-stopped";
    form.healthcheck_command = (x.healthcheck_command as string) ?? "";
    form.extra_ports_raw = Array.isArray(x.extra_ports)
      ? (x.extra_ports as string[]).join("\n")
      : "";
  },
);

const save = async () => {
  const ports = form.extra_ports_raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  // Light validation — host:container with optional protocol suffix.
  // The regex lives in useDockerHelpers so a unit test pins the
  // accepted forms — see tests/composables/useDockerHelpers.test.ts.
  for (const p of ports) {
    if (!isValidPortMapping(p)) {
      toast.error(`"${p}" doesn't look like host:container`);
      return;
    }
  }

  isSaving.value = true;
  try {
    await dockerService.applications.updateAdvanced(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        cpu_limit: form.cpu_limit.trim(),
        memory_limit: form.memory_limit.trim(),
        restart_policy: form.restart_policy,
        healthcheck_command: form.healthcheck_command.trim(),
        extra_ports: ports,
      },
    );
    toast.success("Advanced settings saved");
    emit("updated");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save");
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg border bg-card p-6">
      <h2 class="text-xl font-semibold">Advanced</h2>
      <p class="mt-1 text-sm text-muted-foreground">
        Runtime knobs for <code>docker run</code>. All changes take
        effect on the next deploy.
      </p>

      <form class="mt-6 space-y-4" @submit.prevent="save">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-1">
            <Label for="adv-cpu">CPU limit</Label>
            <Input
              id="adv-cpu"
              v-model="form.cpu_limit"
              placeholder="0.5"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              In <code>docker --cpus</code> format. Leave blank for no
              limit.
            </p>
          </div>
          <div class="space-y-1">
            <Label for="adv-mem">Memory limit</Label>
            <Input
              id="adv-mem"
              v-model="form.memory_limit"
              placeholder="512m"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              In <code>docker -m</code> format (e.g. <code>512m</code>,
              <code>2g</code>).
            </p>
          </div>
        </div>

        <div class="space-y-1">
          <Label>Restart policy</Label>
          <Select v-model="form.restart_policy">
            <SelectTrigger>
              <SelectValue placeholder="Choose policy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="unless-stopped">
                Unless stopped (default)
              </SelectItem>
              <SelectItem value="always">Always</SelectItem>
              <SelectItem value="on-failure">On failure</SelectItem>
              <SelectItem value="no">No</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-1">
          <Label for="adv-health">Healthcheck command</Label>
          <Input
            id="adv-health"
            v-model="form.healthcheck_command"
            placeholder="curl -fsS http://localhost/health || exit 1"
            autocomplete="off"
            class="font-mono text-xs"
          />
          <p class="text-xs text-muted-foreground">
            Runs inside the container. Leave blank to skip.
          </p>
        </div>

        <div class="space-y-1">
          <Label for="adv-ports">Extra published ports</Label>
          <Textarea
            id="adv-ports"
            v-model="form.extra_ports_raw"
            rows="4"
            class="font-mono text-xs"
            placeholder="8080:80&#10;5432:5432/tcp"
          />
          <p class="text-xs text-muted-foreground">
            One <code>host:container</code> mapping per line. Domains
            via the Domains tab are usually a better choice for HTTP
            apps — these are for non-HTTP services you want exposed.
          </p>
        </div>

        <div class="flex justify-end">
          <Button type="submit" :disabled="isSaving">
            <Icon
              v-if="isSaving"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save advanced settings
          </Button>
        </div>
      </form>
    </section>
  </div>
</template>
