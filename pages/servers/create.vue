<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbSeparator,
} from "~/components/ui/breadcrumb";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { Switch } from "~/components/ui/switch";
import { Separator } from "~/components/ui/separator";
import type { SSHKey, ConnectedServerProvider } from "~/types";
import {
  serverService,
  serverProviderService,
  sshKeyService,
  type CreateServerOptions,
} from "~/services/serverService";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

useHead({
  title: "Create Server",
});

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

const isLoading = ref(false);
const isLoadingOptions = ref(true);

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

const { handleSubmit, setFieldValue, values, errors } = useForm({
  validationSchema: schema,
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
    ssh_keys: [],
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
  if (!provider) return [];
  return plans.value[provider]?.plans || [];
});

const currentRegions = computed(() => {
  const provider = values.service_provider;
  if (!provider) return [];
  return plans.value[provider]?.regions || [];
});

const fetchOptions = async () => {
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

onMounted(fetchOptions);
</script>

<template>
  <div class="space-y-6">
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink as-child>
            <NuxtLink to="/servers">Servers</NuxtLink>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator />
        <BreadcrumbItem>
          <BreadcrumbLink>Create Server</BreadcrumbLink>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>

    <div>
      <h1 class="text-3xl font-bold tracking-tight">Create Server</h1>
      <p class="text-muted-foreground">
        Deploy a new server to your infrastructure
      </p>
    </div>

    <div v-if="isLoadingOptions" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <form v-else class="space-y-6" @submit="onSubmit">
      <!-- Provider Selection -->
      <Card>
        <CardHeader>
          <CardTitle>Cloud Provider</CardTitle>
          <CardDescription>Select your server provider</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs
            :model-value="values.service_provider"
            @update:model-value="setStringField('service_provider', $event)"
          >
            <TabsList class="flex h-auto flex-wrap gap-2">
              <TabsTrigger
                v-for="(label, key) in serviceProviders"
                :key="key"
                :value="key"
                class="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
              >
                {{ label }}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <!-- Cloud Provider Account -->
      <Card v-if="values.service_provider !== 'custom_server'">
        <CardHeader>
          <CardTitle>Provider Account</CardTitle>
          <CardDescription
            >Select your connected provider account</CardDescription
          >
        </CardHeader>
        <CardContent>
          <Select
            :model-value="values.server_provider_id"
            @update:model-value="setStringField('server_provider_id', $event)"
          >
            <SelectTrigger>
              <SelectValue placeholder="Select provider account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="provider in filteredProviders"
                :key="provider.id"
                :value="String(provider.id)"
              >
                {{ provider.profile }} ({{
                  serviceProviders[provider.provider]
                }})
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="filteredProviders.length === 0"
            class="mt-2 text-sm text-muted-foreground"
          >
            No provider accounts connected.
            <NuxtLink
              to="/settings/server-providers"
              class="text-primary hover:underline"
            >
              Connect a provider
            </NuxtLink>
          </p>
        </CardContent>
      </Card>

      <!-- Custom Server Details -->
      <Card v-if="values.service_provider === 'custom_server'">
        <CardHeader>
          <CardTitle>Server Connection</CardTitle>
          <CardDescription
            >Enter your server's connection details</CardDescription
          >
        </CardHeader>
        <CardContent class="grid gap-4 md:grid-cols-2">
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
        </CardContent>
      </Card>

      <!-- Server Details -->
      <Card>
        <CardHeader>
          <CardTitle>Server Details</CardTitle>
          <CardDescription>Configure your server settings</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="space-y-2">
            <Label for="name">Server Name</Label>
            <Input
              id="name"
              :model-value="values.name"
              placeholder="my-server"
              @update:model-value="setStringField('name', $event)"
            />
            <p v-if="errors.name" class="text-sm text-destructive">
              {{ errors.name }}
            </p>
          </div>

          <div
            v-if="values.service_provider !== 'custom_server'"
            class="grid gap-4 md:grid-cols-2"
          >
            <div class="space-y-2">
              <Label for="plan">Server Size</Label>
              <Select
                :model-value="values.plan"
                @update:model-value="setStringField('plan', $event)"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select size" />
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
              <Label for="region">Region</Label>
              <Select
                :model-value="values.region"
                @update:model-value="setStringField('region', $event)"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select region" />
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

          <div class="space-y-2">
            <Label for="type">Server Type</Label>
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
        </CardContent>
      </Card>

      <!-- Software Stack -->
      <Card>
        <CardHeader>
          <CardTitle>Software Stack</CardTitle>
          <CardDescription>Configure the software to install</CardDescription>
        </CardHeader>
        <CardContent class="space-y-4">
          <div class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <Label for="operating_system">Operating System</Label>
              <Select
                :model-value="values.operating_system"
                @update:model-value="
                  setStringField('operating_system', $event)
                "
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

            <div v-if="values.type !== 'database'" class="space-y-2">
              <Label for="php">PHP Version</Label>
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
              <Label for="database">Database</Label>
              <Select
                :model-value="values.database"
                @update:model-value="setStringField('database', $event)"
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select database" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(label, key) in databaseTypes"
                    :key="key"
                    :value="key"
                  >
                    {{ label }}
                  </SelectItem>
                  <SelectItem value="none">None</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Separator />

          <div
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <Label>Install Launch Agent</Label>
              <p class="text-sm text-muted-foreground">
                Required for backups, monitoring, and advanced features
              </p>
            </div>
            <Switch
              :checked="values.install_agent"
              @update:checked="setFieldValue('install_agent', $event)"
            />
          </div>
        </CardContent>
      </Card>

      <!-- Submit -->
      <div class="flex justify-end gap-4">
        <Button
          type="button"
          variant="outline"
          @click="navigateTo('/servers')"
        >
          Cancel
        </Button>
        <Button type="submit" :disabled="isLoading || !canCreateServer">
          <Icon
            v-if="isLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          Create Server
        </Button>
      </div>
    </form>
  </div>
</template>
