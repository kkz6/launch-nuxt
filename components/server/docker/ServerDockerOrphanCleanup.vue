<script setup lang="ts">
import { toast } from "vue-sonner";
import { dockerService } from "~/services/dockerService";

/**
 * ServerDockerOrphanCleanup — Danger Zone card for cleaning up compose
 * resources that were left behind by a failed or interrupted stack delete.
 *
 * When a compose stack is deleted the worker runs a label-based teardown
 * script. If the stack was deleted BEFORE the fix was deployed (the old
 * script silently no-op'd without a compose file in cwd), the containers
 * kept running even though the DB row was gone. This card lets the user
 * re-trigger the same cleanup job for any given compose project name,
 * bypassing the missing DB row entirely.
 *
 * Lives in the Projects tab footer — NOT in the Containers tab, where a
 * remove button would create ambiguity about which layer owns container
 * lifecycle.
 */

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

// Dialog open state
const open = ref(false);

// Form state
const projectName = ref("");
const projectSlug = ref("");
const composeSlug = ref("");
const removeVolumes = ref(false);
const isSubmitting = ref(false);

// Derived: show slug fields only when the user opens the "advanced" section.
// The slugs are optional — the script falls back to containers+networks only
// cleanup if they're absent. Most users can leave them blank.
const showAdvanced = ref(false);

const canSubmit = computed(() => projectName.value.trim().length > 0);

const reset = () => {
  projectName.value = "";
  projectSlug.value = "";
  composeSlug.value = "";
  removeVolumes.value = false;
  showAdvanced.value = false;
  isSubmitting.value = false;
};

const handleSubmit = async () => {
  if (!canSubmit.value || isSubmitting.value) return;
  isSubmitting.value = true;
  try {
    await dockerService.host.purgeComposeResources(props.serverId, {
      project_name: projectName.value.trim(),
      project_slug: projectSlug.value.trim() || undefined,
      compose_slug: composeSlug.value.trim() || undefined,
      remove_volumes: removeVolumes.value,
    });
    toast.success("Cleanup job queued — containers will be removed shortly");
    open.value = false;
    reset();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to queue cleanup job");
  } finally {
    isSubmitting.value = false;
  }
};

watch(open, (v) => {
  if (!v) reset();
});
</script>

<template>
  <div class="mt-8 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
    <div class="flex items-start gap-3">
      <Icon
        name="lucide:triangle-alert"
        class="mt-0.5 h-5 w-5 shrink-0 text-destructive"
      />
      <div class="min-w-0 flex-1">
        <h3 class="font-semibold text-sm">Clean up orphaned compose resources</h3>
        <p class="mt-1 text-xs text-muted-foreground">
          If a compose stack was deleted but its containers are still running on
          the host, use this to re-trigger the removal by Docker label. The same
          cleanup job used during a normal stack delete will run against the
          project name you provide.
        </p>
        <div class="mt-3">
          <Dialog v-model:open="open">
            <DialogTrigger as-child>
              <Button variant="destructive" size="sm">
                <Icon name="lucide:trash-2" class="mr-2 h-3.5 w-3.5" />
                Run cleanup
              </Button>
            </DialogTrigger>

            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Clean up orphaned compose resources</DialogTitle>
                <DialogDescription>
                  This queues a job that removes every container, network, and
                  (optionally) volume carrying the
                  <code class="rounded bg-muted px-1 text-xs">com.docker.compose.project</code>
                  label matching the name you enter. The DB row is not needed —
                  this works for stacks that are already deleted from the UI.
                </DialogDescription>
              </DialogHeader>

              <div class="space-y-4 py-2">
                <!-- Project name (required) -->
                <div class="space-y-1.5">
                  <label class="text-sm font-medium">
                    Compose project name
                    <span class="text-destructive">*</span>
                  </label>
                  <Input
                    v-model="projectName"
                    placeholder="e.g. myproject-mystack"
                    class="font-mono text-sm"
                  />
                  <p class="text-xs text-muted-foreground">
                    The value of the
                    <code class="rounded bg-muted px-0.5">com.docker.compose.project</code>
                    label — visible in the Containers tab or via
                    <code class="rounded bg-muted px-0.5">docker ps --format "{{"{{"}}{{".Labels"}}}}"</code>
                  </p>
                </div>

                <!-- Remove volumes toggle -->
                <div class="flex items-center justify-between rounded-lg border p-3">
                  <div class="space-y-0.5">
                    <p class="text-sm font-medium">Remove volumes</p>
                    <p class="text-xs text-muted-foreground">
                      Also delete named volumes created by this stack. Cannot be
                      undone — leave off to preserve data.
                    </p>
                  </div>
                  <Switch v-model:checked="removeVolumes" />
                </div>

                <!-- Advanced — path slugs for disk cleanup -->
                <div>
                  <button
                    type="button"
                    class="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    @click="showAdvanced = !showAdvanced"
                  >
                    <Icon
                      :name="showAdvanced ? 'lucide:chevron-down' : 'lucide:chevron-right'"
                      class="h-3.5 w-3.5"
                    />
                    Advanced — also clean up stack directory &amp; Traefik config
                  </button>

                  <div v-if="showAdvanced" class="mt-3 space-y-3 pl-4 border-l">
                    <p class="text-xs text-muted-foreground">
                      Optional. When provided, the cleanup script also removes
                      the stack directory at
                      <code class="rounded bg-muted px-0.5">/var/lib/launch/projects/&lt;project-slug&gt;/&lt;compose-slug&gt;</code>
                      and the Traefik config file for this stack.
                    </p>
                    <div class="grid grid-cols-2 gap-3">
                      <div class="space-y-1">
                        <label class="text-xs font-medium">Project slug</label>
                        <Input
                          v-model="projectSlug"
                          placeholder="e.g. myproject"
                          class="font-mono text-xs"
                        />
                      </div>
                      <div class="space-y-1">
                        <label class="text-xs font-medium">Compose slug</label>
                        <Input
                          v-model="composeSlug"
                          placeholder="e.g. mystack"
                          class="font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  @click="open = false"
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  :disabled="!canSubmit || isSubmitting"
                  @click="handleSubmit"
                >
                  <Icon
                    v-if="isSubmitting"
                    name="lucide:loader-2"
                    class="mr-2 h-3.5 w-3.5 animate-spin"
                  />
                  <Icon
                    v-else
                    name="lucide:trash-2"
                    class="mr-2 h-3.5 w-3.5"
                  />
                  {{ isSubmitting ? "Queuing..." : "Run cleanup" }}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </div>
  </div>
</template>
