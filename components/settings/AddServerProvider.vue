<script setup lang="ts">
import { toast } from "vue-sonner";
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

const emit = defineEmits<{
  created: [];
}>();

const { t } = useI18n();

const open = ref(false);
const isLoading = ref(false);
const provider = ref("");
const profile = ref("");
const credentials = ref({
  api_token: "",
  access_key: "",
  secret_key: "",
  region: "",
});
const errors = ref<Record<string, string>>({});

const providers = [
  {
    value: "digitalocean",
    label: "DigitalOcean",
    icon: "simple-icons:digitalocean",
  },
  { value: "vultr", label: "Vultr", icon: "simple-icons:vultr" },
  { value: "linode", label: "Linode", icon: "simple-icons:linode" },
  { value: "hetzner", label: "Hetzner", icon: "simple-icons:hetzner" },
  {
    value: "aws",
    label: "Amazon Web Services",
    icon: "simple-icons:amazonaws",
  },
];

const awsRegions = computed(() => [
  {
    value: "us-east-1",
    label: t("settings.connectionDialogs.regions.usEastVirginia"),
  },
  {
    value: "us-east-2",
    label: t("settings.connectionDialogs.regions.usEastOhio"),
  },
  {
    value: "us-west-1",
    label: t("settings.connectionDialogs.regions.usWestCalifornia"),
  },
  {
    value: "us-west-2",
    label: t("settings.connectionDialogs.regions.usWestOregon"),
  },
  {
    value: "eu-west-1",
    label: t("settings.connectionDialogs.regions.euIreland"),
  },
  {
    value: "eu-west-2",
    label: t("settings.connectionDialogs.regions.euLondon"),
  },
  {
    value: "eu-central-1",
    label: t("settings.connectionDialogs.regions.euFrankfurt"),
  },
  {
    value: "ap-southeast-1",
    label: t("settings.connectionDialogs.regions.apSingapore"),
  },
  {
    value: "ap-southeast-2",
    label: t("settings.connectionDialogs.regions.apSydney"),
  },
  {
    value: "ap-northeast-1",
    label: t("settings.connectionDialogs.regions.apTokyo"),
  },
]);

const needsApiToken = computed(() =>
  ["digitalocean", "vultr", "linode", "hetzner"].includes(provider.value),
);
const needsAwsCredentials = computed(() => provider.value === "aws");

const resetForm = () => {
  provider.value = "";
  profile.value = "";
  credentials.value = {
    api_token: "",
    access_key: "",
    secret_key: "",
    region: "",
  };
  errors.value = {};
};

const validate = () => {
  errors.value = {};

  if (!provider.value) {
    errors.value.provider = t(
      "settings.connectionDialogs.validation.selectProvider",
    );
  }
  if (!profile.value.trim()) {
    errors.value.profile = t(
      "settings.connectionDialogs.validation.profileRequired",
    );
  }

  if (needsApiToken.value && !credentials.value.api_token.trim()) {
    errors.value.api_token = t(
      "settings.connectionDialogs.validation.apiTokenRequired",
    );
  }

  if (needsAwsCredentials.value) {
    if (!credentials.value.access_key.trim()) {
      errors.value.access_key = t(
        "settings.connectionDialogs.validation.accessKeyRequired",
      );
    }
    if (!credentials.value.secret_key.trim()) {
      errors.value.secret_key = t(
        "settings.connectionDialogs.validation.secretKeyRequired",
      );
    }
    if (!credentials.value.region) {
      errors.value.region = t(
        "settings.connectionDialogs.validation.regionRequired",
      );
    }
  }

  return Object.keys(errors.value).length === 0;
};

const onSubmit = async () => {
  if (!validate()) return;

  isLoading.value = true;

  try {
    const body: Record<string, string> = {
      provider: provider.value,
      profile: profile.value,
    };

    if (needsApiToken.value) {
      body.api_token = credentials.value.api_token;
    }

    if (needsAwsCredentials.value) {
      body.access_key = credentials.value.access_key;
      body.secret_key = credentials.value.secret_key;
      body.region = credentials.value.region;
    }

    await $api("/server-providers", {
      method: "POST",
      body,
    });

    toast.success(t("settings.connectionDialogs.server.connected"));
    emit("created");
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as {
      data?: { message?: string; errors?: Record<string, string[]> };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message || t("settings.connectionDialogs.connectFailed"),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (!isOpen) resetForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button variant="outline" size="sm">
        <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
        {{ t("settings.connectionDialogs.connect") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{
          t("settings.connectionDialogs.server.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.connectionDialogs.server.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label>{{ t("settings.connectionDialogs.provider") }}</Label>
          <Select v-model="provider">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('settings.connectionDialogs.selectProvider')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="p in providers"
                :key="p.value"
                :value="p.value"
              >
                <div class="flex items-center gap-2">
                  <Icon :name="p.icon" class="h-4 w-4" />
                  {{ p.label }}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.provider" class="text-sm text-destructive">
            {{ errors.provider }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="profile">{{
            t("settings.connectionDialogs.profileName")
          }}</Label>
          <Input
            id="profile"
            v-model="profile"
            :placeholder="
              t('settings.connectionDialogs.server.profilePlaceholder')
            "
          />
          <p v-if="errors.profile" class="text-sm text-destructive">
            {{ errors.profile }}
          </p>
        </div>

        <!-- API Token (for DO, Vultr, Linode, Hetzner) -->
        <div v-if="needsApiToken" class="space-y-2">
          <Label for="api_token">{{
            t("settings.connectionDialogs.apiToken")
          }}</Label>
          <Input
            id="api_token"
            v-model="credentials.api_token"
            type="password"
            :placeholder="t('settings.connectionDialogs.apiTokenPlaceholder')"
          />
          <p v-if="errors.api_token" class="text-sm text-destructive">
            {{ errors.api_token }}
          </p>
        </div>

        <!-- AWS Credentials -->
        <template v-if="needsAwsCredentials">
          <div class="space-y-2">
            <Label for="access_key">{{
              t("settings.connectionDialogs.accessKeyId")
            }}</Label>
            <Input
              id="access_key"
              v-model="credentials.access_key"
              placeholder="AKIAIOSFODNN7EXAMPLE"
            />
            <p v-if="errors.access_key" class="text-sm text-destructive">
              {{ errors.access_key }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="secret_key">{{
              t("settings.connectionDialogs.secretAccessKey")
            }}</Label>
            <Input
              id="secret_key"
              v-model="credentials.secret_key"
              type="password"
              :placeholder="
                t('settings.connectionDialogs.secretKeyPlaceholder')
              "
            />
            <p v-if="errors.secret_key" class="text-sm text-destructive">
              {{ errors.secret_key }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{ t("settings.connectionDialogs.region") }}</Label>
            <Select v-model="credentials.region">
              <SelectTrigger>
                <SelectValue
                  :placeholder="t('settings.connectionDialogs.selectRegion')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="r in awsRegions"
                  :key="r.value"
                  :value="r.value"
                >
                  {{ r.label }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p v-if="errors.region" class="text-sm text-destructive">
              {{ errors.region }}
            </p>
          </div>
        </template>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.connectionDialogs.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.connectionDialogs.connect") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
