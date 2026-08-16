<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerCompose,
  type DockerDomain,
} from "~/services/dockerService";

// Mirrors components/application/Domains.vue. The data shape is
// identical (same polymorphic DockerDomain), so the table layout is
// reused — only the extra `Service` column + the routing through
// `dockerService.composes.domains` differ.
//
// Per-row Validate-DNS state keyed by id so concurrent validations
// don't stomp each other's spinner.
const validatingDns = ref<Set<string>>(new Set());

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

const domains = ref<DockerDomain[]>([]);
const isLoading = ref(true);

const selectedDomain = ref<DockerDomain | null>(null);
const isEditDialogOpen = ref(false);

const confirmationDialog = ref<
  InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null
>(null);

const fetchDomains = async (silent = false) => {
  if (!silent) isLoading.value = true;
  try {
    const res = await dockerService.composes.domains.list(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    domains.value = res.data;
  } catch {
    if (!silent) toast.error("Failed to load domains");
  } finally {
    isLoading.value = false;
  }
};

const editDomain = (d: DockerDomain) => {
  selectedDomain.value = d;
  isEditDialogOpen.value = true;
};

const handleDomainUpdated = () => {
  isEditDialogOpen.value = false;
  selectedDomain.value = null;
  fetchDomains();
};

watch(isEditDialogOpen, (open) => {
  if (!open) selectedDomain.value = null;
});

const validateDns = async (d: DockerDomain) => {
  if (validatingDns.value.has(d.id)) return;
  validatingDns.value = new Set([...validatingDns.value, d.id]);
  try {
    const res = await dockerService.composes.domains.validateDNS(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
      d.id,
    );
    const v = res.data;
    if (v.ok) {
      toast.success(v.message || "DNS resolves to the docker server");
    } else if (v.proxied) {
      // Not necessarily a misconfiguration, so a neutral tone.
      toast.info(v.message || "Domain is proxied through Cloudflare", {
        duration: 8000,
      });
    } else {
      toast.warning(v.message || "DNS does not point at this server", {
        duration: 6000,
      });
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to validate DNS");
  } finally {
    const next = new Set(validatingDns.value);
    next.delete(d.id);
    validatingDns.value = next;
  }
};

const checkCertificate = (d: DockerDomain) =>
  dockerService.composes.domains.checkCertificate(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    d.id,
  );

const retryCertificate = (d: DockerDomain) =>
  dockerService.composes.domains.retryCertificate(
    props.compose.server_id,
    props.compose.project_id,
    props.compose.id,
    d.id,
  );

const removeDomain = async (d: DockerDomain) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: "Remove Domain",
    description: `Remove "${d.host}" from this stack? Traefik will stop routing requests for this host.`,
    confirmText: "Remove",
    cancelText: "Cancel",
    destructive: true,
  });
  if (!result.ok) return;
  try {
    await dockerService.composes.domains.delete(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
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

    <ComposeCreateDomain
      v-if="selectedDomain"
      v-model:open="isEditDialogOpen"
      :compose="compose"
      :domain="selectedDomain"
      @updated="handleDomainUpdated"
    />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">Domains</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          Route public hostnames to a service in this stack's compose
          YAML. Each domain targets a specific
          <span class="font-medium">service</span> + container
          <span class="font-medium">port</span>; the platform writes a
          Traefik file pointing at the compose-managed container.
          <strong>Wire the service into the
          <code class="font-mono text-xs">launch-network</code> in your
          YAML</strong> so Traefik can reach it.
        </p>
      </div>
      <ComposeCreateDomain
        v-if="domains.length > 0"
        :compose="compose"
        @created="fetchDomains"
      />
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
        Add a hostname + service + port. Make sure the target service
        joins the <code class="font-mono">launch-network</code> in the
        compose YAML (declared as
        <code class="font-mono">external: true</code> at the top level).
      </p>
      <div class="mt-6">
        <ComposeCreateDomain
          :compose="compose"
          @created="fetchDomains"
        />
      </div>
    </div>

    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
        >
          <tr>
            <th class="px-4 py-3">URL</th>
            <th class="px-4 py-3">Service</th>
            <th class="px-4 py-3">Port</th>
            <th class="px-4 py-3">HTTPS</th>
            <th class="px-4 py-3">Cert</th>
            <th class="px-4 py-3">DNS</th>
            <th class="px-4 py-3" />
          </tr>
        </thead>
        <tbody>
          <tr v-for="d in domains" :key="d.id" class="border-t align-top">
            <td class="px-4 py-3">
              <a
                :href="fullUrl(d)"
                target="_blank"
                rel="noopener"
                class="inline-flex items-center gap-1.5 font-mono text-sm hover:underline"
              >
                {{ fullUrl(d) }}
                <Icon
                  name="lucide:external-link"
                  class="h-3.5 w-3.5 shrink-0"
                />
              </a>
              <p
                v-if="
                  d.path ||
                  d.strip_path ||
                  (d.internal_path && d.internal_path !== '/')
                "
                class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"
              >
                <span v-if="d.path">
                  Path: <code class="font-mono">{{ d.path }}</code>
                </span>
                <span
                  v-if="d.path && (d.strip_path || (d.internal_path && d.internal_path !== '/'))"
                >
                  ·
                </span>
                <span v-if="d.internal_path && d.internal_path !== '/'">
                  Internal:
                  <code class="font-mono">{{ d.internal_path }}</code>
                </span>
                <span
                  v-if="
                    d.strip_path && d.internal_path && d.internal_path !== '/'
                  "
                >
                  ·
                </span>
                <span v-if="d.strip_path">strip path</span>
              </p>
            </td>

            <td class="px-4 py-3 font-mono text-xs">
              <span v-if="d.service_name" class="rounded bg-muted/50 px-1.5 py-0.5">
                {{ d.service_name }}
              </span>
              <span v-else class="text-muted-foreground">—</span>
            </td>

            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ d.container_port ?? "—" }}
            </td>

            <td class="px-4 py-3">
              <span
                class="rounded-full px-2 py-0.5 text-xs font-medium"
                :class="
                  d.https
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300'
                "
              >
                {{ d.https ? "Enabled" : "Disabled" }}
              </span>
            </td>

            <td class="px-4 py-3 text-xs text-muted-foreground">
              <div v-if="d.https" class="space-y-1.5">
                <span class="font-mono">{{ d.certificate_provider }}</span>
                <SharedCertificateStatus
                  compact
                  :check="() => checkCertificate(d)"
                  :retry="() => retryCertificate(d)"
                />
              </div>
              <span v-else>—</span>
            </td>

            <td class="px-4 py-3">
              <button
                type="button"
                class="inline-flex items-center gap-1.5 rounded-full border border-amber-500/50 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-500/20 disabled:opacity-60 dark:text-amber-400"
                :disabled="validatingDns.has(d.id)"
                @click="validateDns(d)"
              >
                <Icon
                  :name="
                    validatingDns.has(d.id)
                      ? 'lucide:loader-2'
                      : 'lucide:refresh-cw'
                  "
                  :class="[
                    'h-3 w-3',
                    validatingDns.has(d.id) && 'animate-spin',
                  ]"
                />
                Validate
              </button>
            </td>

            <td class="px-4 py-3 text-right">
              <Button
                variant="ghost"
                size="icon"
                title="Edit domain"
                @click="editDomain(d)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                title="Remove domain"
                class="hover:bg-destructive/90 hover:text-white"
                @click="removeDomain(d)"
              >
                <Icon name="lucide:trash-2" class="h-4 w-4" />
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
