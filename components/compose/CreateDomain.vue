<script setup lang="ts">
import { toast } from "vue-sonner";
import { useDebounceFn } from "@vueuse/core";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Switch } from "~/components/ui/switch";
import {
  dockerService,
  type DockerCompose,
  type DockerDomain,
} from "~/services/dockerService";

// Compose Domains create / edit dialog. Mirrors
// components/application/CreateDomain.vue with two differences:
//
//   1. A `Service` picker — populated from
//      `dockerService.composes.listServices` (the same endpoint the
//      Logs picker uses). The operator picks WHICH service in the
//      YAML this domain routes to. Free-text fallback when the
//      backend can't enumerate services yet (e.g. first deploy
//      hasn't run); the operator types the name themselves and the
//      Traefik renderer will resolve it against the running stack.
//
//   2. `container_port` is required (no fallback to an "app
//      internal_port" since compose stacks don't have one — every
//      service declares its own port in YAML).

interface Props {
  compose: DockerCompose;
  domain?: DockerDomain;
}
const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});

// Form state.
const host = ref(props.domain?.host || "");
const path = ref(props.domain?.path || "");
const internalPath = ref(props.domain?.internal_path || "/");
const stripPath = ref(props.domain?.strip_path ?? false);
const containerPort = ref<number | undefined>(
  props.domain?.container_port ?? undefined,
);
const https = ref(props.domain?.https ?? true);
const certificateProvider = ref<"letsencrypt">(
  (props.domain?.certificate_provider as "letsencrypt") || "letsencrypt",
);
const serviceName = ref(props.domain?.service_name || "");

// Services pulled from `docker compose ps --services` server-side.
// Empty list = stack never deployed (or the SSH call failed); fall
// back to a plain text input so the operator can still type a name.
const availableServices = ref<string[]>([]);
const isLoadingServices = ref(false);
const fetchServices = async () => {
  isLoadingServices.value = true;
  try {
    const res = await dockerService.composes.listServices(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    availableServices.value = res.data || [];
  } catch {
    availableServices.value = [];
  } finally {
    isLoadingServices.value = false;
  }
};

// Domain verification (same as application path — talks to the DNS
// module's /sites/verify-domain endpoint).
interface DomainVerification {
  verified: boolean;
  domain: string;
  base_domain: string;
  connected_domain_id?: string;
  can_create_record: boolean;
}
const isVerifyingDomain = ref(false);
const domainVerification = ref<DomainVerification | null>(null);
const createDnsRecord = ref(false);

const resetForm = () => {
  host.value = props.domain?.host || "";
  path.value = props.domain?.path || "";
  internalPath.value = props.domain?.internal_path || "/";
  stripPath.value = props.domain?.strip_path ?? false;
  containerPort.value = props.domain?.container_port ?? undefined;
  https.value = props.domain?.https ?? true;
  certificateProvider.value =
    (props.domain?.certificate_provider as "letsencrypt") || "letsencrypt";
  serviceName.value = props.domain?.service_name || "";
  errors.value = {};
  domainVerification.value = null;
  createDnsRecord.value = false;
};

const WILDCARD_DNS_SUFFIXES = [".sslip.io", ".nip.io", ".localtest.me"];
const isWildcardDnsHost = (h: string): boolean =>
  WILDCARD_DNS_SUFFIXES.some((s) => h.toLowerCase().endsWith(s));

const verifyDomain = async (domain: string) => {
  if (!domain || domain.length < 3) {
    domainVerification.value = null;
    createDnsRecord.value = false;
    return;
  }
  if (isWildcardDnsHost(domain)) {
    domainVerification.value = null;
    createDnsRecord.value = false;
    return;
  }
  isVerifyingDomain.value = true;
  try {
    const result = await $api<{ data: DomainVerification }>(
      "/sites/verify-domain",
      { params: { domain } },
    );
    domainVerification.value = result.data;
    if (result.data.verified && result.data.can_create_record) {
      createDnsRecord.value = true;
    }
  } catch {
    domainVerification.value = null;
  } finally {
    isVerifyingDomain.value = false;
  }
};
const debouncedVerify = useDebounceFn(verifyDomain, 500);
const onHostChange = (v: string | number) => {
  const next = String(v).trim().toLowerCase();
  host.value = next;
  debouncedVerify(next);
};

// Wildcard-DNS shuffle button — identical to the application path's
// generator. Pulls server IP from the shared `currentServerPublicIp`
// useState bus the project chrome already populates.
const sharedServerIp = useState<string | null>(
  "currentServerPublicIp",
  () => null,
);
const sixHexHash = () => {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};
const generateWildcardHost = () => {
  const slugComposeName =
    (props.compose.name || "stack")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "stack";
  const hash = sixHexHash();
  const ip = sharedServerIp.value || "";
  const slugIp = ip ? `-${ip.replaceAll(".", "-").replaceAll(":", "-")}` : "";
  const proposed = `${slugComposeName}-${hash}${slugIp}.sslip.io`;
  host.value = proposed;
  debouncedVerify(proposed);
};

const onSubmit = async () => {
  errors.value = {};
  const trimmedHost = host.value.trim().toLowerCase();
  if (!trimmedHost) {
    errors.value.host = t("workload.domains.hostRequired");
    return;
  }
  if (!serviceName.value.trim()) {
    errors.value.service_name = t("workload.domains.serviceRequired");
    return;
  }
  if (!containerPort.value || containerPort.value <= 0) {
    errors.value.container_port = t("workload.domains.containerPortRequired");
    return;
  }

  isLoading.value = true;
  try {
    if (props.domain) {
      await dockerService.composes.domains.update(
        props.compose.server_id,
        props.compose.project_id,
        props.compose.id,
        props.domain.id,
        {
          path: path.value.trim(),
          internal_path: internalPath.value.trim() || "/",
          strip_path: stripPath.value,
          container_port: containerPort.value,
          https: https.value,
          certificate_provider: certificateProvider.value,
          service_name: serviceName.value.trim(),
        },
      );
      toast.success(t("workload.domains.updated"));
      emit("updated");
    } else {
      await dockerService.composes.domains.create(
        props.compose.server_id,
        props.compose.project_id,
        props.compose.id,
        {
          host: trimmedHost,
          path: path.value.trim() || undefined,
          internal_path: internalPath.value.trim() || "/",
          strip_path: stripPath.value,
          container_port: containerPort.value,
          https: https.value,
          certificate_provider: certificateProvider.value,
          service_name: serviceName.value.trim(),
          create_dns_record:
            createDnsRecord.value &&
            !!domainVerification.value?.can_create_record,
          connected_domain_id:
            domainVerification.value?.connected_domain_id || null,
        },
      );
      toast.success(t("workload.domains.added"));
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || t("workload.domains.saveFailed"));
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm();
    fetchServices();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{
          domain ? t("workload.domains.editTitle") : t("workload.domains.add")
        }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{
          domain
            ? t("workload.domains.editTitle")
            : t("workload.domains.domain")
        }}</DialogTitle>
        <DialogDescription>
          {{ t("workload.domains.addComposeBeforeNetwork") }}
          <code class="font-mono text-xs">launch-network</code>
          {{ t("workload.domains.addComposeAfterNetwork") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="onSubmit">
        <!-- Host (with the wildcard-DNS shuffle button). Edit mode
             disables the input — host is immutable on update because
             renaming would orphan the cert. -->
        <div class="space-y-2">
          <Label for="cdomain-host">{{ t("workload.fields.host") }}</Label>
          <div class="relative flex gap-2">
            <div class="relative flex-1">
              <Input
                id="cdomain-host"
                :model-value="host"
                :disabled="!!domain"
                placeholder="api.example.com"
                @update:model-value="onHostChange"
              />
              <div
                v-if="isVerifyingDomain"
                class="absolute right-3 top-1/2 -translate-y-1/2"
              >
                <Icon
                  name="lucide:loader-2"
                  class="h-4 w-4 animate-spin text-muted-foreground"
                />
              </div>
            </div>
            <Button
              v-if="!domain"
              type="button"
              variant="outline"
              size="icon"
              :title="t('workload.domains.generateWildcard')"
              @click="generateWildcardHost"
            >
              <Icon name="lucide:shuffle" class="h-4 w-4" />
            </Button>
          </div>
          <p v-if="errors.host" class="text-sm text-destructive">
            {{ errors.host }}
          </p>

          <div
            v-if="!domain && host && isWildcardDnsHost(host)"
            class="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950"
          >
            <Icon
              name="lucide:info"
              class="h-4 w-4 text-sky-600 dark:text-sky-400"
            />
            <span class="text-sm text-sky-700 dark:text-sky-300">
              {{ t("workload.domains.wildcardReady") }}
            </span>
          </div>
        </div>

        <!-- Service + Port — compose-specific. Service picker
             populated from `docker compose ps --services`; falls
             back to a text input when the stack hasn't been
             deployed yet (services list comes back empty). -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="cdomain-service">{{
              t("workload.fields.service")
            }}</Label>
            <Select v-if="availableServices.length > 0" v-model="serviceName">
              <SelectTrigger id="cdomain-service">
                <SelectValue :placeholder="t('workload.domains.pickService')" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem v-for="s in availableServices" :key="s" :value="s">
                  {{ s }}
                </SelectItem>
              </SelectContent>
            </Select>
            <Input
              v-else
              id="cdomain-service"
              v-model="serviceName"
              placeholder="web"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              <template v-if="isLoadingServices">{{
                t("workload.actions.loading")
              }}</template>
              <template v-else-if="availableServices.length === 0">
                {{ t("workload.domains.stackNotDeployed") }}
              </template>
              <template v-else>
                {{ t("workload.domains.serviceMatchBefore") }}
                <code class="font-mono">services:</code>
                {{ t("workload.domains.serviceMatchAfter") }}
              </template>
            </p>
            <p v-if="errors.service_name" class="text-sm text-destructive">
              {{ errors.service_name }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="cdomain-port">{{
              t("workload.domains.containerPort")
            }}</Label>
            <Input
              id="cdomain-port"
              v-model.number="containerPort"
              type="number"
              min="1"
              max="65535"
              placeholder="3000"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              {{ t("workload.domains.composePortHelp") }}
            </p>
            <p v-if="errors.container_port" class="text-sm text-destructive">
              {{ errors.container_port }}
            </p>
          </div>
        </div>

        <!-- Path overrides (optional). Same field set as the
             application dialog. -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div class="space-y-2">
            <Label for="cdomain-path">{{
              t("workload.domains.externalPath")
            }}</Label>
            <Input
              id="cdomain-path"
              v-model="path"
              placeholder="/api"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              {{ t("workload.domains.externalPathHelp") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="cdomain-internal-path">{{
              t("workload.domains.internalPath")
            }}</Label>
            <Input
              id="cdomain-internal-path"
              v-model="internalPath"
              placeholder="/"
              autocomplete="off"
            />
            <p class="text-[11px] text-muted-foreground">
              {{ t("workload.domains.composeInternalPathHelp") }}
            </p>
          </div>
        </div>

        <!-- HTTPS + strip-path toggles. -->
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div
            class="flex items-start justify-between gap-3 rounded-md border p-3"
          >
            <div class="space-y-0.5">
              <Label class="text-sm font-medium">
                {{ t("workload.domains.https") }}
              </Label>
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.domains.composeHttpsHelp") }}
              </p>
            </div>
            <Switch v-model="https" />
          </div>
          <div
            class="flex items-start justify-between gap-3 rounded-md border p-3"
          >
            <div class="space-y-0.5">
              <Label class="text-sm font-medium">{{
                t("workload.domains.stripPath")
              }}</Label>
              <p class="text-[11px] text-muted-foreground">
                {{ t("workload.domains.stripComposeHelp") }}
              </p>
            </div>
            <Switch v-model="stripPath" />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("workload.actions.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              domain
                ? t("workload.actions.saveChanges")
                : t("workload.domains.add")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
