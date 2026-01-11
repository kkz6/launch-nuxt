<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
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

// Options from API
const serverProviders = ref<ConnectedServerProvider[]>([]);
const phpVersions = ref<Record<string, string>>({});
const databaseTypes = ref<Record<string, string>>({});
const serverTypes = ref<Record<string, string>>({});
const operatingSystems = ref<Record<string, string>>({});
const sshKeys = ref<SSHKey[]>([]);
const plans = ref<Record<string, CloudServiceConfig>>({});
const canCreateServer = ref(true);

const serviceProviders: Record<string, string> = {
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: "Custom Server",
};

const schema = toTypedSchema(
  z.object({
    name: z.string().min(1, "Server name is required").max(255),
    service_provider: z.string().min(1, "Provider is required"),
    server_provider_id: z.string().optional(),
    region: z.string().optional(),
    plan: z.string().optional(),
    type: z.string().default("php"),
    operating_system: z.string().default("ubuntu_24"),
    database: z.string().default("mysql80"),
    php: z.string().default("php83"),
    ssh_keys: z.array(z.string()).default([]),
    ip: z.string().optional(),
    port: z.string().default("22"),
    install_agent: z.boolean().default(true),
  })
);

const { handleSubmit, setFieldValue, values, errors, resetForm } = useForm({
  validationSchema: schema,
  validateOnMount: false,
  initialValues: {
    name: "",
    service_provider: "digitalocean",
    server_provider_id: "",
    region: "",
    plan: "",
    type: "php",
    operating_system: "ubuntu_24",
    database: "mysql80",
    php: "php83",
    ssh_keys: [] as string[],
    ip: "",
    port: "22",
    install_agent: true,
  },
});

// Type-safe field setters
type FormFields =
  | "name"
  | "service_provider"
  | "server_provider_id"
  | "region"
  | "plan"
  | "type"
  | "operating_system"
  | "database"
  | "php"
  | "ip"
  | "port";

const setStringField = (field: FormFields, value: unknown) => {
  setFieldValue(field, value != null ? String(value) : "");
};

const filteredProviders = computed(() => {
  return serverProviders.value.filter(
    (p) => p.provider === values.service_provider
  );
});

const currentPlans = computed(() => {
  const provider = values.service_provider;
  if (!provider || !plans.value[provider]) return [];
  return plans.value[provider]?.plans || [];
});

const currentRegions = computed(() => {
  const provider = values.service_provider;
  if (!provider || !plans.value[provider]) return [];
  return plans.value[provider]?.regions || [];
});

const dbOptions = computed(() => {
  return { ...databaseTypes.value, none: "None" };
});

const fetchOptions = async () => {
  isLoadingOptions.value = true;
  try {
    const [optionsData, providersData, sshData] = await Promise.all([
      serverService.getCreateOptions(),
      serverProviderService.list(),
      sshKeyService.list(),
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
    toast.error("Failed to load server options");
  } finally {
    isLoadingOptions.value = false;
  }
};

const onSubmit = handleSubmit(async (data) => {
  isLoading.value = true;
  try {
    const response = await serverService.create(data);
    toast.success("Server creation initiated");
    isOpen.value = false;
    navigateTo(`/servers/${response.data.id}`);
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
});

// Fetch options when dialog opens
watch(isOpen, (open) => {
  if (open) {
    resetForm();
    fetchOptions();
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button>
        <PlusIcon class="mr-2 h-4 w-4" />
        Create
      </Button>
    </DialogTrigger>

    <DialogContent
      class="sm:max-w-3xl"
      @interact-outside="(e: Event) => e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Create Server</DialogTitle>
        <DialogDescription>
          Deploy a new server to your infrastructure
        </DialogDescription>
      </DialogHeader>

      <div v-if="isLoadingOptions" class="flex items-center justify-center py-8">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-muted-foreground"
        />
      </div>

      <form
        v-else
        id="hook-form-add-server"
        class="grid w-full gap-4"
        @submit="onSubmit"
      >
        <!-- Provider Tabs -->
        <Tabs
          :model-value="values.service_provider"
          class="w-full space-y-2"
          @update:model-value="setStringField('service_provider', $event)"
        >
          <TabsList class="flex flex-row">
            <TabsTrigger
              v-for="(label, key) in serviceProviders"
              :key="key"
              :value="key"
            >
              {{ label }}
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <!-- Server Provider (for cloud providers) -->
        <div v-if="values.service_provider !== 'custom_server'" class="space-y-2">
          <Label>Server Provider</Label>
          <Select
            :model-value="values.server_provider_id"
            @update:model-value="setStringField('server_provider_id', $event)"
          >
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
                    {{ provider.profile }} ({{ serviceProviders[provider.provider] }})
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
          <Label for="name">Name</Label>
          <Input
            id="name"
            :model-value="values.name"
            placeholder="my-awesome-server"
            @update:model-value="setStringField('name', $event)"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <!-- Plan and Region (for cloud providers) -->
        <div
          v-if="values.service_provider !== 'custom_server'"
          class="grid grid-cols-1 gap-3 lg:grid-cols-2"
        >
          <div class="space-y-2">
            <Label>Plan</Label>
            <Select
              :model-value="values.plan"
              @update:model-value="setStringField('plan', $event)"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a plan" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="plan in currentPlans"
                  :key="plan.value"
                  :value="plan.value"
                >
                  {{ plan.title }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div class="space-y-2">
            <Label>Region</Label>
            <Select
              :model-value="values.region"
              @update:model-value="setStringField('region', $event)"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a region" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="region in currentRegions"
                  :key="region.value"
                  :value="region.value"
                >
                  {{ region.title }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <!-- IP and Port (for custom server) -->
        <div
          v-if="values.service_provider === 'custom_server'"
          class="grid grid-cols-2 gap-3"
        >
          <div class="space-y-2">
            <Label for="ip">IP Address</Label>
            <Input
              id="ip"
              :model-value="values.ip"
              placeholder="192.168.1.1"
              @update:model-value="setStringField('ip', $event)"
            />
          </div>
          <div class="space-y-2">
            <Label for="port">SSH Port</Label>
            <Input
              id="port"
              :model-value="values.port"
              placeholder="22"
              @update:model-value="setStringField('port', $event)"
            />
          </div>
        </div>

        <!-- SSH Keys -->
        <div class="space-y-2">
          <Label>SSH Keys</Label>
          <Select disabled>
            <SelectTrigger>
              <SelectValue placeholder="Select SSH keys" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="key in sshKeys"
                :key="key.id"
                :value="key.id"
              >
                {{ key.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <!-- Server Type -->
        <div class="grid grid-cols-2 gap-3">
          <div class="space-y-2">
            <Label>Type</Label>
            <Select
              :model-value="values.type"
              @update:model-value="setStringField('type', $event)"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="(label, key) in serverTypes"
                  :key="key"
                  :value="key"
                >
                  {{ label }}
                </SelectItem>
              </SelectContent>
            </Select>
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
            :disabled="isLoading || !canCreateServer"
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
    <DialogContent
      class="border-2 border-border/50 sm:max-w-2xl"
      @interact-outside="(e: Event) => e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>Advanced Options</DialogTitle>
        <DialogDescription>
          Configure additional server settings
        </DialogDescription>
      </DialogHeader>

      <div class="mt-4 space-y-6">
        <!-- Server Configuration Group -->
        <div class="space-y-4 border-b border-border/50 pb-4">
          <h3 class="text-sm font-medium text-foreground">
            Server Configuration
          </h3>
          <div class="space-y-2">
            <Label>Operating System</Label>
            <Select
              :model-value="values.operating_system"
              @update:model-value="setStringField('operating_system', $event)"
            >
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
          <h3 class="text-sm font-medium text-foreground">Software Stack</h3>
          <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div v-if="values.type !== 'database'" class="space-y-2">
              <Label>PHP Version</Label>
              <Select
                :model-value="values.php"
                @update:model-value="setStringField('php', $event)"
              >
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

            <div class="space-y-2">
              <Label>Database</Label>
              <Select
                :model-value="values.database"
                @update:model-value="setStringField('database', $event)"
              >
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
          </div>
        </div>

        <!-- Agent Configuration Group -->
        <div class="space-y-4">
          <h3 class="text-sm font-medium text-foreground">
            Agent Configuration
          </h3>
          <div class="flex items-start space-x-3 rounded-md border p-4">
            <Checkbox
              id="install_agent"
              :checked="values.install_agent"
              @update:checked="setFieldValue('install_agent', $event)"
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
