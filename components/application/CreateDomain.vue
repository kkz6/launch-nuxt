<script setup lang="ts">
import { reactive, toRefs } from "vue";
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
  type DockerApplication,
  type DockerDomain,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
  domain?: DockerDomain;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });

interface DomainVerification {
  verified: boolean;
  domain: string;
  base_domain: string;
  connected_domain_id?: string;
  can_create_record: boolean;
}

interface DomainState {
  isLoading: boolean;
  errors: Record<string, string>;
  host: string;
  path: string;
  internalPath: string;
  stripPath: boolean;
  containerPort: number | undefined;
  https: boolean;
  certificateProvider: "letsencrypt" | "stored";
  storedCertificateId: string | null;
  isVerifyingDomain: boolean;
  domainVerification: DomainVerification | null;
  createDnsRecord: boolean;
}

const state = reactive({
  isLoading: false,
  errors: {},
  host: props.domain?.host || "",
  path: props.domain?.path || "",
  internalPath: props.domain?.internal_path || "/",
  stripPath: props.domain?.strip_path ?? false,
  containerPort:
    props.domain?.container_port ?? props.application.internal_port ?? 80,
  https: props.domain?.https ?? true,
  certificateProvider:
    (props.domain?.certificate_provider as "letsencrypt" | "stored") ||
    "letsencrypt",
  storedCertificateId:
    (props.domain as { stored_certificate_id?: string | null })
      ?.stored_certificate_id || null,
  isVerifyingDomain: false,
  domainVerification: null,
  createDnsRecord: false,
}) as DomainState;

const {
  isLoading,
  errors,
  host,
  path,
  internalPath,
  stripPath,
  containerPort,
  https,
  certificateProvider,
  storedCertificateId,
  isVerifyingDomain,
  domainVerification,
  createDnsRecord,
} = toRefs(state);

const resetForm = () => {
  host.value = props.domain?.host || "";
  path.value = props.domain?.path || "";
  internalPath.value = props.domain?.internal_path || "/";
  stripPath.value = props.domain?.strip_path ?? false;
  containerPort.value =
    props.domain?.container_port ?? props.application.internal_port ?? 80;
  https.value = props.domain?.https ?? true;
  certificateProvider.value =
    (props.domain?.certificate_provider as "letsencrypt" | "stored") ||
    "letsencrypt";
  storedCertificateId.value =
    (props.domain as { stored_certificate_id?: string | null })
      ?.stored_certificate_id || null;
  errors.value = {};
  domainVerification.value = null;
  createDnsRecord.value = false;
};

const WILDCARD_DNS_SUFFIXES = [".sslip.io", ".nip.io", ".localtest.me"];

const isWildcardDnsHost = (host: string): boolean => {
  const h = host.toLowerCase();
  return WILDCARD_DNS_SUFFIXES.some((s) => h.endsWith(s));
};

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
  const slugAppName =
    (props.application.name || "app")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app";
  const hash = sixHexHash();
  const ip = sharedServerIp.value || "";
  const slugIp = ip ? `-${ip.replaceAll(".", "-").replaceAll(":", "-")}` : "";
  const proposed = `${slugAppName}-${hash}${slugIp}.sslip.io`;
  host.value = proposed;
  debouncedVerify(proposed);
};

const onSubmit = async () => {
  errors.value = {};
  const trimmedHost = host.value.trim().toLowerCase();
  if (!trimmedHost) {
    errors.value.host = "Host is required";
    return;
  }
  if (!containerPort.value || containerPort.value <= 0) {
    errors.value.container_port = "Container port is required";
    return;
  }

  isLoading.value = true;
  try {
    if (props.domain) {
      await dockerService.applications.updateDomain(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        props.domain.id,
        {
          path: path.value.trim(),
          internal_path: internalPath.value.trim() || "/",
          strip_path: stripPath.value,
          container_port: containerPort.value,
          https: https.value,
          certificate_provider: certificateProvider.value,
          stored_certificate_id:
            certificateProvider.value === "stored"
              ? storedCertificateId.value
              : "",
        },
      );
      toast.success("Domain updated");
      emit("updated");
    } else {
      await dockerService.applications.createDomain(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        {
          host: trimmedHost,
          path: path.value.trim() || undefined,
          internal_path: internalPath.value.trim() || "/",
          strip_path: stripPath.value,
          container_port: containerPort.value,
          https: https.value,
          certificate_provider: certificateProvider.value,
          stored_certificate_id:
            certificateProvider.value === "stored"
              ? storedCertificateId.value
              : null,
          create_dns_record:
            createDnsRecord.value &&
            !!domainVerification.value?.can_create_record,
          connected_domain_id:
            domainVerification.value?.connected_domain_id || null,
        },
      );
      toast.success("Domain added — Traefik is updating");
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(e.data?.message || "Failed to save domain");
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ domain ? "Edit Domain" : "Add Domain" }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ domain ? "Edit Domain" : "Domain" }}</DialogTitle>
        <DialogDescription>
          {{
            domain
              ? "In this section you can edit a domain."
              : "Attach a public hostname to this application. Traefik handles routing and the TLS certificate."
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="domain-host">Host</Label>
          <div class="relative flex gap-2">
            <div class="relative flex-1">
              <Input
                id="domain-host"
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
              title="Generate a wildcard-DNS hostname pointing at this server (sslip.io)"
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
              Wildcard DNS hostname — already routable, no provider setup
              required.
            </span>
          </div>

          <div v-if="!domain && domainVerification && host" class="pt-1">
            <div
              v-if="
                domainVerification.verified &&
                domainVerification.can_create_record
              "
              class="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950"
            >
              <div class="flex items-center gap-2">
                <Icon
                  name="lucide:check-circle"
                  class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                />
                <span class="text-sm text-emerald-700 dark:text-emerald-300">
                  Domain connected via
                  <strong>{{ domainVerification.base_domain }}</strong>
                </span>
              </div>
              <div class="flex items-center gap-2">
                <Label
                  for="create_dns"
                  class="text-sm text-emerald-700 dark:text-emerald-300"
                >
                  Create A record
                </Label>
                <Switch id="create_dns" v-model="createDnsRecord" />
              </div>
            </div>
            <div
              v-else
              class="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950"
            >
              <Icon
                name="lucide:alert-circle"
                class="h-4 w-4 text-amber-600 dark:text-amber-400"
              />
              <span class="text-sm text-amber-700 dark:text-amber-300">
                Domain not connected. Add
                <strong>{{ domainVerification.base_domain }}</strong> to your
                DNS providers to auto-create records.
              </span>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label for="domain-path">Path</Label>
          <Input
            id="domain-path"
            v-model="path"
            placeholder="/api"
            autocomplete="off"
          />
        </div>

        <div class="space-y-2">
          <Label for="domain-internal-path">Internal Path</Label>
          <p class="text-xs text-muted-foreground">
            The path where your application expects to receive requests
            internally (defaults to "/")
          </p>
          <Input
            id="domain-internal-path"
            v-model="internalPath"
            placeholder="/"
            autocomplete="off"
          />
        </div>

        <div
          class="flex items-start justify-between gap-4 rounded-lg border p-3"
        >
          <div class="space-y-0.5">
            <Label class="text-sm font-medium">Strip Path</Label>
            <p class="text-xs text-muted-foreground">
              Remove the external path from the request before forwarding to the
              application
            </p>
          </div>
          <Switch v-model="stripPath" class="mt-0.5 shrink-0" />
        </div>

        <div class="space-y-2">
          <Label for="domain-container-port">Container Port</Label>
          <p class="text-xs text-muted-foreground">
            The port where your application is running inside the container
            (e.g., 3000 for Node.js, 80 for Nginx, 8080 for Java)
          </p>
          <Input
            id="domain-container-port"
            v-model.number="containerPort"
            type="number"
            min="1"
            max="65535"
            placeholder="8080"
            autocomplete="off"
          />
          <p v-if="errors.container_port" class="text-sm text-destructive">
            {{ errors.container_port }}
          </p>
        </div>

        <div
          class="flex items-start justify-between gap-4 rounded-lg border p-3"
        >
          <div class="space-y-0.5">
            <Label class="text-sm font-medium">HTTPS</Label>
            <p class="text-xs text-muted-foreground">
              Automatically provision SSL Certificate.
            </p>
          </div>
          <Switch v-model="https" class="mt-0.5 shrink-0" />
        </div>

        <div v-if="https" class="space-y-2">
          <Label for="domain-cert-provider">Certificate Provider</Label>
          <Select v-model="certificateProvider">
            <SelectTrigger id="domain-cert-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letsencrypt">Let's Encrypt (auto)</SelectItem>
              <SelectItem value="stored">Use a stored certificate</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div v-if="https && certificateProvider === 'stored'" class="space-y-2">
          <Label>Stored certificate</Label>
          <SharedCertificatePicker v-model="storedCertificateId" />
          <p
            v-if="errors.stored_certificate_id"
            class="text-xs text-destructive"
          >
            {{ errors.stored_certificate_id }}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            Cancel
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ domain ? "Update" : "Add Domain" }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
