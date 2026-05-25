<script setup lang="ts">
import { toast } from "vue-sonner";
import { dockerService } from "~/services/dockerService";

/**
 * ServerDockerOrphanCleanup — Maintenance card for cleaning up compose
 * resources left behind by failed/interrupted stack deletes.
 *
 * History: an earlier teardown script silently no-op'd when run without
 * a compose file in cwd, so containers kept running after their DB row
 * was deleted. This card re-triggers the same label-based cleanup job
 * (driven by the compose project name alone), bypassing the missing
 * DB row entirely.
 *
 * Lives under Advanced → Maintenance (docker-only). NOT in the
 * Containers tab — putting it there would suggest container lifecycle
 * is managed at that level, which it isn't.
 */

interface Props {
  serverId: string;
}
const props = defineProps<Props>();

// Dialog open state — the trigger is a discrete settings button; the
// dialog is where the actual destructive confirmation happens.
const open = ref(false);

const projectName = ref("");
const projectSlug = ref("");
const composeSlug = ref("");
const removeVolumes = ref(false);
const isSubmitting = ref(false);

// Advanced panel hidden by default — most uses don't need slugs.
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
  <div class="space-y-6">
    <!--
      Plain settings card — matches the look of other Advanced subtabs
      (General / SSH Keys / Services). No red Danger Zone styling
      because this isn't actually destructive in the normal sense: it
      runs the same cleanup that a regular compose delete would.
    -->
    <Card>
      <CardHeader>
        <CardTitle>Orphaned compose stacks</CardTitle>
        <CardDescription>
          Re-run the compose teardown for a stack that's no longer in the UI
          but whose containers are still running on the host. The same job
          used during a normal stack delete is queued against the project
          name you provide.
        </CardDescription>
      </CardHeader>
      <CardContent class="space-y-4">
        <div class="rounded-md bg-muted/40 p-3 text-sm text-muted-foreground">
          <p>
            Look up the compose project name in the
            <span class="font-medium text-foreground">Containers</span> tab —
            it's the
            <code class="rounded bg-background px-1 text-xs">com.docker.compose.project</code>
            label on the orphaned containers, typically formatted as
            <code class="rounded bg-background px-1 text-xs">&lt;project-slug&gt;-&lt;compose-slug&gt;</code>.
          </p>
        </div>

        <Dialog v-model:open="open">
          <DialogTrigger as-child>
            <Button variant="outline" size="sm">
              <Icon name="lucide:eraser" class="mr-2 h-3.5 w-3.5" />
              Run cleanup
            </Button>
          </DialogTrigger>

          <DialogContent class="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Clean up orphaned compose stack</DialogTitle>
              <DialogDescription>
                Removes every container, network, and (optionally) volume
                carrying the
                <code class="rounded bg-muted px-1 text-xs">com.docker.compose.project</code>
                label matching the project name below.
              </DialogDescription>
            </DialogHeader>

            <div class="space-y-4 py-2">
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
              </div>

              <div class="flex items-center justify-between rounded-lg border p-3">
                <div class="space-y-0.5">
                  <p class="text-sm font-medium">Remove volumes</p>
                  <p class="text-xs text-muted-foreground">
                    Also delete named volumes. Cannot be undone.
                  </p>
                </div>
                <Switch v-model:checked="removeVolumes" />
              </div>

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
                  Also clean up stack directory &amp; Traefik config
                </button>

                <div v-if="showAdvanced" class="mt-3 space-y-3 pl-4 border-l">
                  <p class="text-xs text-muted-foreground">
                    Optional. Removes
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
              <Button variant="outline" @click="open = false">Cancel</Button>
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
                {{ isSubmitting ? "Queuing..." : "Run cleanup" }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  </div>
</template>
