<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  dockerService,
  type DockerApplication,
  type DockerDomain,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();

const domains = ref<DockerDomain[]>([]);
const isLoading = ref(true);

const addOpen = ref(false);
const form = reactive({ host: "", path: "", https: true });
const isAdding = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchDomains = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.applications.listDomains(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
    );
    domains.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load domains");
  } finally {
    isLoading.value = false;
  }
};

const openAdd = () => {
  form.host = "";
  form.path = "";
  form.https = true;
  addOpen.value = true;
};

const submitAdd = async () => {
  const host = form.host.trim().toLowerCase();
  if (!host) {
    toast.error("Host is required");
    return;
  }
  isAdding.value = true;
  try {
    const res = await dockerService.applications.createDomain(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      {
        host,
        path: form.path.trim() || undefined,
        https: form.https,
      },
    );
    domains.value = [...domains.value, res.data].sort((a, b) =>
      a.host.localeCompare(b.host),
    );
    toast.success("Domain added — Traefik is updating");
    addOpen.value = false;
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to add domain");
  } finally {
    isAdding.value = false;
  }
};

const toggleHttps = async (d: DockerDomain) => {
  const newValue = !d.https;
  try {
    const res = await dockerService.applications.updateDomain(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      d.id,
      { https: newValue },
    );
    // Replace in-place so the row's other fields aren't reset.
    const idx = domains.value.findIndex((x) => x.id === d.id);
    if (idx >= 0) domains.value[idx] = res.data;
    toast.success(newValue ? "HTTPS enabled" : "HTTPS disabled");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to update domain");
  }
};

const removeDomain = async (d: DockerDomain) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove Domain",
    description: `Remove "${d.host}" from this application? Traefik will stop routing requests for this host.`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.applications.deleteDomain(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      d.id,
    );
    domains.value = domains.value.filter((x) => x.id !== d.id);
    toast.success("Domain removed");
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to remove domain");
  }
};

const fullUrl = (d: DockerDomain): string => {
  const scheme = d.https ? "https" : "http";
  return `${scheme}://${d.host}${d.path || ""}`;
};

onMounted(fetchDomains);
</script>

<template>
  <div>
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Domains</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Public hostnames routed to this application by Traefik. HTTPS
          domains are served with Let's Encrypt certificates.
        </p>
      </div>
      <Button @click="openAdd">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Domain
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="domains.length === 0"
      class="flex flex-col items-center justify-center rounded-lg border border-dashed py-16"
    >
      <Icon name="lucide:globe" class="h-12 w-12 text-muted-foreground" />
      <h3 class="mt-4 text-lg font-medium">No domains yet</h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        Point a DNS A record at the docker server's public IP, then add
        the hostname here. Traefik handles the certificate.
      </p>
      <Button class="mt-6" @click="openAdd">
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        Add Domain
      </Button>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th class="px-4 py-3">URL</th>
            <th class="px-4 py-3">HTTPS</th>
            <th class="px-4 py-3"></th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in domains" :key="d.id" class="border-t">
            <td class="px-4 py-3">
              <a
                :href="fullUrl(d)"
                target="_blank"
                rel="noopener"
                class="flex items-center gap-1.5 font-mono text-sm hover:underline"
              >
                {{ fullUrl(d) }}
                <Icon name="lucide:external-link" class="h-3.5 w-3.5" />
              </a>
            </td>
            <td class="px-4 py-3">
              <button
                class="inline-flex items-center gap-2 text-xs"
                @click="toggleHttps(d)"
              >
                <span
                  class="rounded-full px-2 py-0.5 font-medium"
                  :class="
                    d.https
                      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                      : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300'
                  "
                >
                  {{ d.https ? "Enabled" : "Disabled" }}
                </span>
                <Icon name="lucide:refresh-cw" class="h-3 w-3 opacity-50" />
              </button>
            </td>
            <td class="px-4 py-3 text-right">
              <Button variant="ghost" size="icon" @click="removeDomain(d)">
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Dialog v-model:open="addOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Domain</DialogTitle>
          <DialogDescription>
            Point an A record at this server's public IP, then add the
            hostname below. Certificate issuance can take ~30 seconds.
          </DialogDescription>
        </DialogHeader>
        <form class="space-y-4" @submit.prevent="submitAdd">
          <div class="space-y-2">
            <Label for="domain-host">Host</Label>
            <Input
              id="domain-host"
              v-model="form.host"
              placeholder="api.example.com"
              autocomplete="off"
              required
            />
          </div>
          <div class="space-y-2">
            <Label for="domain-path">Path prefix (optional)</Label>
            <Input
              id="domain-path"
              v-model="form.path"
              placeholder="/api"
              autocomplete="off"
            />
            <p class="text-xs text-muted-foreground">
              Leave blank to route all paths to this app.
            </p>
          </div>
          <label class="flex cursor-pointer items-center gap-2 text-sm">
            <input v-model="form.https" type="checkbox" class="h-4 w-4" />
            Enable HTTPS via Let's Encrypt
          </label>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              :disabled="isAdding"
              @click="addOpen = false"
            >
              Cancel
            </Button>
            <Button type="submit" :disabled="isAdding">
              <Icon
                v-if="isAdding"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              Add Domain
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
