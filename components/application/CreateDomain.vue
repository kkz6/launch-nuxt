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
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});

// Mirrors dokploy's Domain modal field set. We add the DNS-record
// auto-creation toggle from AddSite.vue (the PHP-site dialog the
// user pointed at) — same /sites/verify-domain endpoint, same
// behaviour.

// Form state. Default port comes from the application's
// internal_port so the user sees a sensible value pre-filled; they
// can still override per-domain.
const host = ref(props.domain?.host || "");
const path = ref(props.domain?.path || "");
const internalPath = ref(props.domain?.internal_path || "/");
const stripPath = ref(props.domain?.strip_path ?? false);
const containerPort = ref<number | undefined>(
  props.domain?.container_port ?? props.application.internal_port ?? 80,
);
const https = ref(props.domain?.https ?? true);
const certificateProvider = ref<"letsencrypt">(
  (props.domain?.certificate_provider as "letsencrypt") || "letsencrypt",
);

// Domain verification — same shape AddSite.vue uses. The endpoint
// lives under /sites because it predates the docker module; we just
// piggyback on it.
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
  containerPort.value =
    props.domain?.container_port ?? props.application.internal_port ?? 80;
  https.value = props.domain?.https ?? true;
  certificateProvider.value =
    (props.domain?.certificate_provider as "letsencrypt") || "letsencrypt";
  errors.value = {};
  domainVerification.value = null;
  createDnsRecord.value = false;
};

// Wildcard-DNS services that need no provisioning — sslip.io and
// nip.io resolve every `*.tld` back to the IP encoded in the label.
// Skip the DNS-provider verification path entirely for these:
// there's no "connected base domain" to find, and surfacing the
// amber "Domain not connected" banner is misleading when the
// hostname is already routable.
//
// `traefik.me` is intentionally NOT in this list — despite its
// name, it does NOT encode an IP from the subdomain. Public
// resolvers return SERVFAIL for `<ip-dashed>.traefik.me`. It only
// resolves `traefik.me` itself to 127.0.0.1 for loopback testing.
// We were burned by this: anyone using the shuffle button with
// .traefik.me got an unresolvable hostname.
const WILDCARD_DNS_SUFFIXES = [
  ".sslip.io",
  ".nip.io",
  ".localtest.me",
];

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
  // Skip verification entirely for wildcard-DNS hostnames. No
  // banner, no toggle — the user already has a working URL.
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

// Generate a sslip.io hostname (matches dokploy's `generateRandomDomain`
// which also lands on sslip.io despite the UI sometimes labeling the
// button "traefik.me" — traefik.me does NOT actually encode an IP from
// the subdomain; it only resolves to 127.0.0.1).
//
// Pattern: `{appName-truncated}-{6-hex-hash}-{ip-with-dashes}.sslip.io`
//
// sslip.io is a wildcard-DNS service that resolves any
// `<…ip-with-dashes>.sslip.io` straight to that IP — no DNS
// provisioning required. Perfect for spinning up an instantly-
// routable hostname against the docker server's public IP for
// testing, without touching the user's real DNS.
//
// We pull the IP from the shared navbar useState bus the project
// chrome already populates ("currentServerPublicIp"). DNS labels
// max out at 63 chars, so we truncate the app name to keep the
// final segment well under the limit.
const sharedServerIp = useState<string | null>(
  "currentServerPublicIp",
  () => null,
);

const sixHexHash = () => {
  // 6 random hex chars — same length dokploy uses.
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 6; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
};

const generateWildcardHost = () => {
  const slugAppName = (props.application.name || "app")
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
      // Edit mode — server checks identical-host so we don't send it.
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
        <!-- Host (with the shuffle button — matches the dokploy
             dialog you screenshotted). Edit mode disables it; host
             is immutable on update because renaming would orphan the
             cert. -->
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

          <!--
            Wildcard-DNS hint. When the user types (or generates) a
            *.traefik.me / *.sslip.io / *.nip.io host the verification
            call is skipped (no DNS provider needed — the hostname
            already resolves). Surface a quiet info chip so it's
            obvious why no green/amber banner appears below.
          -->
          <div
            v-if="!domain && host && isWildcardDnsHost(host)"
            class="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950"
          >
            <Icon
              name="lucide:info"
              class="h-4 w-4 text-sky-600 dark:text-sky-400"
            />
            <span class="text-sm text-sky-700 dark:text-sky-300">
              Wildcard DNS hostname — already routable, no provider
              setup required.
            </span>
          </div>

          <!-- Verification banner — green when the base domain is
               connected, amber when it isn't. Same shape AddSite uses. -->
          <div v-if="!domain && domainVerification && host" class="pt-1">
            <div
              v-if="
                domainVerification.verified && domainVerification.can_create_record
              "
              class="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-900 dark:bg-emerald-950"
            >
              <div class="flex items-center gap-2">
                <Icon
                  name="lucide:check-circle"
                  class="h-4 w-4 text-emerald-600 dark:text-emerald-400"
                />
                <span
                  class="text-sm text-emerald-700 dark:text-emerald-300"
                >
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
                <strong>{{ domainVerification.base_domain }}</strong> to
                your DNS providers to auto-create records.
              </span>
            </div>
          </div>
        </div>

        <!-- Path (external) -->
        <div class="space-y-2">
          <Label for="domain-path">Path</Label>
          <Input
            id="domain-path"
            v-model="path"
            placeholder="/api"
            autocomplete="off"
          />
        </div>

        <!-- Internal Path -->
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

        <!-- Strip Path -->
        <div
          class="flex items-start justify-between gap-4 rounded-lg border p-3"
        >
          <div class="space-y-0.5">
            <Label class="text-sm font-medium">Strip Path</Label>
            <p class="text-xs text-muted-foreground">
              Remove the external path from the request before
              forwarding to the application
            </p>
          </div>
          <Switch v-model="stripPath" class="mt-0.5 shrink-0" />
        </div>

        <!-- Container Port -->
        <div class="space-y-2">
          <Label for="domain-container-port">Container Port</Label>
          <p class="text-xs text-muted-foreground">
            The port where your application is running inside the
            container (e.g., 3000 for Node.js, 80 for Nginx, 8080 for
            Java)
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

        <!-- HTTPS -->
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

        <!-- Certificate Provider (only when HTTPS=true) -->
        <div v-if="https" class="space-y-2">
          <Label for="domain-cert-provider">Certificate Provider</Label>
          <Select v-model="certificateProvider">
            <SelectTrigger id="domain-cert-provider">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="letsencrypt">Let's Encrypt</SelectItem>
            </SelectContent>
          </Select>
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
