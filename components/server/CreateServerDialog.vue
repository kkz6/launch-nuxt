<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
import { PlusIcon, Settings2 } from "lucide-vue-next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Checkbox } from "~/components/ui/checkbox";
import type { SSHKey, ConnectedServerProvider } from "~/types";
import {
  serverService,
  serverProviderService,
  sshKeyService,
} from "~/services/serverService";

interface Plan {
  value: string;
  title: string;
  specs?: string;
}

interface Region {
  value: string;
  title: string;
}

interface CloudServiceConfig {
  plans: Plan[];
  regions: Region[];
}

const isOpen = ref(false);
const isAdvancedOpen = ref(false);
const isLoading = ref(false);
const isLoadingOptions = ref(false);
const errors = ref<Record<string, string>>({});

// Get the shared refresh key to trigger server list refresh
const serversRefreshKey = useState('serversRefreshKey', () => 0);

// Options from API
const serverProviders = ref<ConnectedServerProvider[]>([]);
const phpVersions = ref<Record<string, string>>({});
const databaseTypes = ref<Record<string, string>>({});
const serverTypes = ref<Record<string, string>>({});
const operatingSystems = ref<Record<string, string>>({});
const sshKeys = ref<SSHKey[]>([]);
const plans = ref<Record<string, CloudServiceConfig>>({});
const canCreateServer = ref(true);

// Form values
const name = ref("");
const serviceProvider = ref("digitalocean");
const serverProviderId = ref("");
const region = ref("");
const plan = ref("");
const serverType = ref("php");
const operatingSystem = ref("ubuntu_24");
const database = ref("mysql80");
const php = ref("php83");
const selectedSshKeys = ref<string[]>([]);
const ip = ref("");
const port = ref("22");
const installAgent = ref(true);

const serviceProviders: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom Server",
};

const schema = z.object({
  name: z.string().min(1, "Server name is required").max(255),
  service_provider: z.string().min(1, "Provider is required"),
  server_provider_id: z.string().optional(),
  region: z.string().optional(),
  plan: z.string().optional(),
  type: z.string(),
  operating_system: z.string(),
  database: z.string(),
  php: z.string(),
  ssh_keys: z.array(z.string()),
  ip: z.string().optional(),
  port: z.string(),
  install_agent: z.boolean(),
});

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (!canCreateServer.value) return false;
  if (name.value.trim().length === 0) return false;
  return true;
});

const resetForm = () => {
  name.value = "";
  serviceProvider.value = "digitalocean";
  serverProviderId.value = "";
  region.value = "";
  plan.value = "";
  serverType.value = "php";
  operatingSystem.value = "ubuntu_24";
  database.value = "mysql80";
  php.value = "php83";
  selectedSshKeys.value = [];
  ip.value = "";
  port.value = "22";
  installAgent.value = true;
  errors.value = {};
};

const validate = () => {
  // Coerce optional fields to "none" when they don't apply to the chosen server
  // type. Keeps the payload aligned with the backend DTO and prevents UI state
  // from leaking through when the user switches type after editing the field.
  const rules = getServerTypeRules(serverType.value);

  const result = schema.safeParse({
    name: name.value.trim(),
    service_provider: serviceProvider.value,
    server_provider_id: serverProviderId.value || undefined,
    region: region.value || undefined,
    plan: plan.value || undefined,
    type: serverType.value,
    operating_system: operatingSystem.value,
    database: rules.showsDatabase ? database.value : "none",
    php: rules.showsPhp ? php.value : "none",
    ssh_keys: selectedSshKeys.value,
    ip: ip.value || undefined,
    port: port.value,
    install_agent: installAgent.value,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      service_provider: fieldErrors.service_provider?.[0] || "",
      server_provider_id: fieldErrors.server_provider_id?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const filteredProviders = computed(() => {
  return serverProviders.value.filter(
    (p) => p.provider === serviceProvider.value
  );
});

const currentPlans = computed(() => {
  const provider = serviceProvider.value;
  if (!provider || !plans.value[provider]) return [];
  return plans.value[provider]?.plans || [];
});

const currentRegions = computed(() => {
  const provider = serviceProvider.value;
  if (!provider || !plans.value[provider]) return [];
  return plans.value[provider]?.regions || [];
});

const dbOptions = computed(() => {
  return { ...databaseTypes.value, none: "None" };
});

// Capability rules per server type (mirrors backend ServerType.GetFeatures()).
// Drives which optional fields are visible in Advanced Options and what the
// final payload looks like — see useServerTypeRules.ts.
const typeRules = computed(() => getServerTypeRules(serverType.value));

// Whether we already have enough data to render the form. Used to skip
// the full-dialog spinner on subsequent opens — the spinner caused a
// visible "dialog opens small → resizes large" flicker because the
// loading state replaced the entire form for ~300-500ms on every click.
const hasOptions = computed(() => Object.keys(serverTypes.value).length > 0);

const fetchOptions = async (silent = false) => {
  if (!silent) isLoadingOptions.value = true;
  try {
    const [optionsData, providersData, sshData] = await Promise.all([
      serverService.getCreateOptions(),
      serverProviderService.list(),
      sshKeyService.list(true),
    ]);

    phpVersions.value = optionsData.data.phpVersions;
    databaseTypes.value = optionsData.data.databaseTypes;
    serverTypes.value = optionsData.data.serverTypes;
    operatingSystems.value = optionsData.data.operatingSystems;
    plans.value = optionsData.data.plans;
    canCreateServer.value = optionsData.data.canCreateServer;
    serverProviders.value = providersData.data;
    sshKeys.value = sshData.data;
  } catch {
    if (!silent) toast.error("Failed to load server options");
  } finally {
    isLoadingOptions.value = false;
  }
};

// Pre-fetch on mount so by the time the user clicks Create, options are
// already cached. The dialog component only mounts when the user is on
// /servers (see Navbar.vue v-if), so this isn't wasted work elsewhere.
onMounted(() => {
  fetchOptions(true);
});

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    await serverService.create(data);
    toast.success("Server creation initiated");
    isOpen.value = false;
    // Trigger server list refresh
    serversRefreshKey.value++;
  } catch (error: unknown) {
    const err = error as {
      data?: { message?: string; errors?: Record<string, string[]> };
    };
    if (err.data?.errors) {
      Object.entries(err.data.errors).forEach(([, messages]) => {
        toast.error(messages[0]);
      });
    } else {
      toast.error(err.data?.message || "Failed to create server");
    }
  } finally {
    isLoading.value = false;
  }
};

// Open behaviour: reset form, then refresh data. If we already have
// options (from onMounted prefetch or a previous open), refresh silently
// in the background — the form renders immediately with cached data and
// the dialog doesn't visibly resize. Only the first open with cold cache
// shows the spinner.
watch(isOpen, (open) => {
  if (!open) return;
  resetForm();
  fetchOptions(hasOptions.value);
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <!-- On mobile we collapse to an icon-only button so the tabs nav has
           enough room. The label reappears at sm and up. -->
      <Button class="px-2.5 sm:px-4" aria-label="Create server">
        <PlusIcon class="h-4 w-4 sm:mr-2" />
        <span class="hidden sm:inline">Create</span>
      </Button>
    </DialogTrigger>

    <DialogContent class="sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle>Create Server</DialogTitle>
        <DialogDescription>
          Deploy a new server to your infrastructure
        </DialogDescription>
      </DialogHeader>

      <!-- Reserve roughly the form's height so the dialog doesn't visibly
           shrink-then-grow on the very first open if the prefetch hasn't
           landed yet. After that, hasOptions=true and we skip this state
           entirely (silent refresh). -->
      <div
        v-if="isLoadingOptions"
        class="flex min-h-[440px] flex-col items-center justify-center gap-3"
      >
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
        <p class="text-sm text-muted-foreground">Loading options...</p>
      </div>

      <form
        v-else
        id="hook-form-add-server"
        class="grid w-full gap-4"
        @submit.prevent="onSubmit"
      >
        <!-- Provider Tabs -->
        <Tabs
          v-model="serviceProvider"
          class="w-full space-y-2"
        >
          <TabsList class="flex flex-row">
            <TabsTrigger
              v-for="(label, key) in serviceProviders"
              :key="key"
              :value="key"
              class="gap-2"
            >
              <Icon :name="getProviderIcon(key)" class="h-4 w-4" />
              {{ label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Server Provider (for cloud providers) -->
        <div v-if="serviceProvider !== 'custom_server'" class="space-y-2">
          <Label class="flex items-center gap-2">
            <Icon name="lucide:key-round" class="h-4 w-4 text-muted-foreground" />
            Server Provider
          </Label>
          <Select v-model="serverProviderId">
            <SelectTrigger>
              <SelectValue placeholder="Select a provider account" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <template v-if="filteredProviders.length > 0">
                  <SelectItem
                    v-for="provider in filteredProviders"
                    :key="provider.id"
                    :value="String(provider.id)"
                  >
                    <span class="flex items-center gap-2">
                      <Icon :name="getProviderIcon(provider.provider)" class="h-4 w-4" />
                      {{ provider.profile }} ({{ serviceProviders[provider.provider] }})
                    </span>
                  </SelectItem>
                </template>
                <SelectLabel v-else class="text-muted-foreground">
                  No provider accounts connected
                </SelectLabel>
              </SelectGroup>
            </SelectContent>
          </Select>
          <p v-if="errors.server_provider_id" class="text-sm text-destructive">
            {{ errors.server_provider_id }}
          </p>
        </div>

        <!-- Server Name -->
        <div class="space-y-2">
          <Label for="name" class="flex items-center gap-2">
            <Icon name="lucide:tag" class="h-4 w-4 text-muted-foreground" />
            Name
          </Label>
          <Input
            id="name"
            v-model="name"
            placeholder="my-awesome-server"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <!-- Plan and Region (for cloud providers) -->
        <div
          v-if="serviceProvider !== 'custom_server'"
          class="grid grid-cols-1 gap-3 lg:grid-cols-2"
        >
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <Icon name="lucide:layers" class="h-4 w-4 text-muted-foreground" />
              Plan
            </Label>
            <Select v-model="plan">
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="p in currentPlans"
                  :key="p.value"
                  :value="p.value"
                >
                  {{ p.title }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <Icon name="lucide:globe" class="h-4 w-4 text-muted-foreground" />
              Region
            </Label>
            <Select v-model="region">
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="r in currentRegions"
                  :key="r.value"
                  :value="r.value"
                >
                  {{ r.title }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- IP and Port (for custom server) -->
        <div
          v-if="serviceProvider === 'custom_server'"
          class="grid grid-cols-2 gap-3"
        >
          <div class="space-y-2">
            <Label for="ip" class="flex items-center gap-2">
              <Icon name="lucide:globe-2" class="h-4 w-4 text-muted-foreground" />
              IP Address
            </Label>
            <Input
              id="ip"
              v-model="ip"
              placeholder="192.168.1.1"
            />
          </div>
          <div class="space-y-2">
            <Label for="port" class="flex items-center gap-2">
              <Icon name="lucide:plug" class="h-4 w-4 text-muted-foreground" />
              SSH Port
            </Label>
            <Input
              id="port"
              v-model="port"
              placeholder="22"
            />
          </div>
        </div>

        <!-- SSH Keys -->
        <div class="space-y-2">
          <Label class="flex items-center gap-2">
            <Icon name="lucide:key" class="h-4 w-4 text-muted-foreground" />
            SSH Keys
          </Label>
          <div v-if="sshKeys.length === 0" class="rounded-md border border-dashed p-3 text-center text-sm text-muted-foreground">
            No SSH keys available. Add one in Settings.
          </div>
          <div v-else class="grid gap-2">
            <div
              v-for="key in sshKeys"
              :key="key.id"
              class="flex items-center gap-3 rounded-md border p-3"
            >
              <Checkbox
                :id="`ssh-key-${key.id}`"
                :checked="selectedSshKeys.includes(key.id)"
                @update:checked="(checked: boolean) => {
                  if (checked) {
                    selectedSshKeys.push(key.id)
                  } else {
                    selectedSshKeys = selectedSshKeys.filter(id => id !== key.id)
                  }
                }"
              />
              <Label :for="`ssh-key-${key.id}`" class="flex-1 cursor-pointer">
                <span class="font-medium">{{ key.name }}</span>
                <span v-if="key.fingerprint" class="ml-2 font-mono text-xs text-muted-foreground">
                  {{ key.fingerprint.slice(0, 20) }}...
                </span>
              </Label>
            </div>
          </div>
        </div>

        <!-- Server Type -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <Icon name="lucide:server" class="h-4 w-4 text-muted-foreground" />
              Type
            </Label>
            <Select v-model="serverType">
              <SelectTrigger>
                <span class="flex items-center gap-2">
                  <Icon :name="getServerTypeIcon(serverType)" class="h-4 w-4" />
                  <SelectValue placeholder="Select type" />
                </span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(label, key) in serverTypes"
                  :key="key"
                  :value="key"
                >
                  <span class="flex items-center gap-2">
                    <Icon :name="getServerTypeIcon(key)" class="h-4 w-4" />
                    {{ label }}
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ typeRules.description }}
            </p>
          </div>
        </div>

        <DialogFooter class="mt-4 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            class="gap-2"
            @click="isAdvancedOpen = true"
          >
            <Settings2 class="h-4 w-4" />
            Advanced Options
          </Button>
          <Button
            type="submit"
            :disabled="!canSubmit"
          >
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Create
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>

  <!-- Advanced Options Dialog -->
  <Dialog v-model:open="isAdvancedOpen">
    <DialogContent class="border-2 border-border/50 sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>Advanced Options</DialogTitle>
        <DialogDescription>
          Configure additional server settings
        </DialogDescription>
      </DialogHeader>

      <div class="mt-4 space-y-6">
        <!-- Server Configuration Group -->
        <div class="space-y-4 border-b border-border/50 pb-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon name="lucide:sliders-horizontal" class="h-4 w-4 text-muted-foreground" />
            Server Configuration
          </h3>
          <div class="space-y-2">
            <Label class="flex items-center gap-2">
              <Icon name="lucide:disc" class="h-4 w-4 text-muted-foreground" />
              Operating System
            </Label>
            <Select v-model="operatingSystem">
              <SelectTrigger>
                <SelectValue placeholder="Select OS" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(label, key) in operatingSystems"
                  :key="key"
                  :value="key"
                >
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- Software Stack Group -->
        <div class="space-y-4 border-b border-border/50 pb-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon name="lucide:package" class="h-4 w-4 text-muted-foreground" />
            Software Stack
          </h3>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div v-if="typeRules.showsPhp" class="space-y-2">
              <Label class="flex items-center gap-2">
                <Icon name="lucide:code-2" class="h-4 w-4 text-muted-foreground" />
                PHP Version
              </Label>
              <Select v-model="php">
                <SelectTrigger>
                  <SelectValue placeholder="Select PHP version" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(label, key) in phpVersions"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div v-if="typeRules.showsDatabase" class="space-y-2">
              <Label class="flex items-center gap-2">
                <Icon name="lucide:database" class="h-4 w-4 text-muted-foreground" />
                Database
              </Label>
              <Select v-model="database">
                <SelectTrigger>
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(label, key) in dbOptions"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <p
              v-if="!typeRules.showsPhp && !typeRules.showsDatabase"
              class="col-span-full text-sm text-muted-foreground"
            >
              {{ typeRules.description }}
            </p>
          </div>
        </div>

        <!-- Agent Configuration Group -->
        <div class="space-y-4">
          <h3 class="flex items-center gap-2 text-sm font-medium text-foreground">
            <Icon name="lucide:activity" class="h-4 w-4 text-muted-foreground" />
            Agent Configuration
          </h3>
          <div class="flex items-start space-x-3 rounded-md border p-4">
            <Checkbox
              id="install_agent"
              v-model="installAgent"
            />
            <div class="space-y-1 leading-none">
              <Label for="install_agent" class="cursor-pointer">
                Install Launch Agent
              </Label>
              <p class="text-sm text-muted-foreground">
                Required for backups, monitoring, and advanced features
              </p>
            </div>
          </div>
          <div v-if="!installAgent" class="rounded-md border border-amber-500/50 bg-amber-500/10 p-3">
            <p class="text-sm text-amber-600 dark:text-amber-400">
              <Icon name="lucide:alert-triangle" class="mr-1.5 inline h-4 w-4" />
              Without the Launch Agent, you will not be able to use backups, server metrics, real-time monitoring, and other advanced features.
            </p>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-6">
        <Button variant="outline" @click="isAdvancedOpen = false">
          Close
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
