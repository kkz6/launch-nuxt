<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerApplication,
  type DockerDomain,
} from "~/services/dockerService";

// Per-row Validate-DNS state. Map keyed by domain id so two rows
// can validate in parallel without stomping each other's spinner.
const validatingDns = ref<Set<string>>(new Set());

interface Props {
  application: DockerApplication;
}
const props = defineProps<Props>();
const { t } = useI18n();

// Two dialog modes share the same component (matches Redirects /
// Schedules / Volumes): create vs. edit. selectedDomain drives which.
const domains = ref<DockerDomain[]>([]);
const isLoading = ref(true);

const selectedDomain = ref<DockerDomain | null>(null);
const isEditDialogOpen = ref(false);

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

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
    if (!silent) toast.error(t("workload.domains.loadFailed"));
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
    const res = await dockerService.applications.validateDomainDns(
      props.application.server_id,
      props.application.project_id,
      props.application.id,
      d.id,
    );
    const v = res.data;
    if (v.ok) {
      toast.success(v.message || t("workload.domains.dnsResolves"));
    } else if (v.proxied) {
      // Not necessarily a misconfiguration, so a neutral tone.
      toast.info(v.message || t("workload.domains.proxied"), {
        duration: 8000,
      });
    } else {
      toast.warning(v.message || t("workload.domains.dnsMismatch"), {
        duration: 6000,
      });
    }
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.domains.validateFailed"));
  } finally {
    const next = new Set(validatingDns.value);
    next.delete(d.id);
    validatingDns.value = next;
  }
};

const checkCertificate = (d: DockerDomain) =>
  dockerService.applications.checkDomainCertificate(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    d.id,
  );

const retryCertificate = (d: DockerDomain) =>
  dockerService.applications.retryDomainCertificate(
    props.application.server_id,
    props.application.project_id,
    props.application.id,
    d.id,
  );

const removeDomain = async (d: DockerDomain) => {
  if (!confirmationDialog.value) return;
  const result = await confirmationDialog.value.show({
    title: t("workload.domains.removeTitle"),
    description: t("workload.domains.removeApplicationDescription", {
      host: d.host,
    }),
    confirmText: t("workload.actions.remove"),
    cancelText: t("workload.actions.cancel"),
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
    toast.success(t("workload.domains.removed"));
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.domains.removeFailed"));
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

    <!-- Edit dialog — only mounts when a row is selected so form
         state stays out of the DOM otherwise. Same shape Redirects
         and Schedules use. -->
    <ApplicationCreateDomain
      v-if="selectedDomain"
      v-model:open="isEditDialogOpen"
      :application="application"
      :domain="selectedDomain"
      @updated="handleDomainUpdated"
    />

    <div class="mb-6 flex items-center justify-between">
      <div>
        <h2 class="text-xl font-semibold">
          {{ t("workload.domains.title") }}
        </h2>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("workload.domains.applicationDescription") }}
        </p>
      </div>
      <ApplicationCreateDomain
        v-if="domains.length > 0"
        :application="application"
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
      <h3 class="mt-4 text-lg font-medium">
        {{ t("workload.domains.emptyTitle") }}
      </h3>
      <p class="mt-1 max-w-md text-center text-sm text-muted-foreground">
        {{ t("workload.domains.applicationEmptyDescription") }}
      </p>
      <div class="mt-6">
        <ApplicationCreateDomain
          :application="application"
          @created="fetchDomains"
        />
      </div>
    </div>

    <!--
      Table layout — same shape as Redirects / Volumes / Schedules
      tables. URL is the headline, secondary fields (Path, Internal
      Path, Strip Path) tuck under it as a muted second line when
      non-default to keep the column count tractable. Port / HTTPS /
      Cert / DNS each own a column.
    -->
    <div v-else class="overflow-hidden rounded-lg border">
      <table class="w-full text-sm">
        <thead
          class="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"
        >
          <tr>
            <th class="px-4 py-3">{{ t("workload.domains.url") }}</th>
            <th class="px-4 py-3">{{ t("workload.fields.port") }}</th>
            <th class="px-4 py-3">{{ t("workload.domains.https") }}</th>
            <th class="px-4 py-3">{{ t("workload.domains.certificate") }}</th>
            <th class="px-4 py-3">{{ t("workload.domains.dns") }}</th>
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
              <!--
                Secondary line — only renders when at least one of
                Path / Internal Path / Strip Path is set. Each piece
                separated by `·` to mirror dokploy's compact info
                run.
              -->
              <p
                v-if="
                  d.path ||
                  d.strip_path ||
                  (d.internal_path && d.internal_path !== '/')
                "
                class="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-muted-foreground"
              >
                <span v-if="d.path">
                  {{ t("workload.fields.path") }}:
                  <code class="font-mono">{{ d.path }}</code>
                </span>
                <span
                  v-if="
                    d.path &&
                    (d.strip_path ||
                      (d.internal_path && d.internal_path !== '/'))
                  "
                >
                  ·
                </span>
                <span v-if="d.internal_path && d.internal_path !== '/'">
                  {{ t("workload.domains.internal") }}:
                  <code class="font-mono">{{ d.internal_path }}</code>
                </span>
                <span
                  v-if="
                    d.strip_path && d.internal_path && d.internal_path !== '/'
                  "
                >
                  ·
                </span>
                <span v-if="d.strip_path">{{
                  t("workload.domains.stripPath")
                }}</span>
              </p>
            </td>

            <td class="px-4 py-3 font-mono text-xs text-muted-foreground">
              {{ d.container_port ?? application.internal_port }}
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
                {{
                  d.https
                    ? t("workload.status.enabled")
                    : t("workload.status.disabled")
                }}
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
                {{ t("workload.domains.validate") }}
              </button>
            </td>

            <td class="px-4 py-3 text-right">
              <Button
                variant="ghost"
                size="icon"
                :title="t('workload.domains.editTitle')"
                @click="editDomain(d)"
              >
                <Icon name="lucide:pencil" class="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                :title="t('workload.domains.removeTitle')"
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
