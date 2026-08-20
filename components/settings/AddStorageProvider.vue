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
const label = ref("");
const credentials = ref({
  access_key: "",
  secret_key: "",
  bucket: "",
  region: "",
  endpoint: "",
});
const errors = ref<Record<string, string>>({});

const providers = [
  { value: "s3", label: "Amazon S3", icon: "simple-icons:amazons3" },
  {
    value: "spaces",
    label: "DigitalOcean Spaces",
    icon: "simple-icons:digitalocean",
  },
  { value: "backblaze", label: "Backblaze B2", icon: "simple-icons:backblaze" },
  { value: "wasabi", label: "Wasabi", icon: "lucide:database" },
];

const s3Regions = computed(() => [
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

const spacesRegions = computed(() => [
  { value: "nyc3", label: t("settings.connectionDialogs.regions.newYork3") },
  {
    value: "sfo3",
    label: t("settings.connectionDialogs.regions.sanFrancisco3"),
  },
  { value: "ams3", label: t("settings.connectionDialogs.regions.amsterdam3") },
  { value: "sgp1", label: t("settings.connectionDialogs.regions.singapore1") },
  { value: "fra1", label: t("settings.connectionDialogs.regions.frankfurt1") },
]);

const currentRegions = computed(() => {
  if (provider.value === "s3") return s3Regions.value;
  if (provider.value === "spaces") return spacesRegions.value;
  return [];
});

const showRegion = computed(() => ["s3", "spaces"].includes(provider.value));
const showEndpoint = computed(() =>
  ["backblaze", "wasabi"].includes(provider.value),
);

const resetForm = () => {
  provider.value = "";
  label.value = "";
  credentials.value = {
    access_key: "",
    secret_key: "",
    bucket: "",
    region: "",
    endpoint: "",
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
  if (!label.value.trim()) {
    errors.value.label = t(
      "settings.connectionDialogs.validation.labelRequired",
    );
  }
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
  if (!credentials.value.bucket.trim()) {
    errors.value.bucket = t(
      "settings.connectionDialogs.validation.bucketRequired",
    );
  }
  if (showRegion.value && !credentials.value.region) {
    errors.value.region = t(
      "settings.connectionDialogs.validation.regionRequired",
    );
  }
  if (showEndpoint.value && !credentials.value.endpoint.trim()) {
    errors.value.endpoint = t(
      "settings.connectionDialogs.validation.endpointRequired",
    );
  }

  return Object.keys(errors.value).length === 0;
};

const onSubmit = async () => {
  if (!validate()) return;

  isLoading.value = true;

  try {
    await $api("/storage-providers", {
      method: "POST",
      body: {
        provider: provider.value,
        label: label.value,
        access_key: credentials.value.access_key,
        secret_key: credentials.value.secret_key,
        bucket: credentials.value.bucket,
        region: credentials.value.region || undefined,
        endpoint: credentials.value.endpoint || undefined,
      },
    });

    toast.success(t("settings.connectionDialogs.storage.connected"));
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
          t("settings.connectionDialogs.storage.title")
        }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.connectionDialogs.storage.description") }}
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
          <Label for="label">{{ t("settings.connectionDialogs.label") }}</Label>
          <Input
            id="label"
            v-model="label"
            :placeholder="
              t('settings.connectionDialogs.storage.labelPlaceholder')
            "
          />
          <p v-if="errors.label" class="text-sm text-destructive">
            {{ errors.label }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="access_key">{{
            t("settings.connectionDialogs.accessKey")
          }}</Label>
          <Input
            id="access_key"
            v-model="credentials.access_key"
            :placeholder="t('settings.connectionDialogs.accessKeyPlaceholder')"
          />
          <p v-if="errors.access_key" class="text-sm text-destructive">
            {{ errors.access_key }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="secret_key">{{
            t("settings.connectionDialogs.secretKey")
          }}</Label>
          <Input
            id="secret_key"
            v-model="credentials.secret_key"
            type="password"
            :placeholder="t('settings.connectionDialogs.secretKeyPlaceholder')"
          />
          <p v-if="errors.secret_key" class="text-sm text-destructive">
            {{ errors.secret_key }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="bucket">{{
            t("settings.connectionDialogs.bucketName")
          }}</Label>
          <Input
            id="bucket"
            v-model="credentials.bucket"
            placeholder="my-bucket"
          />
          <p v-if="errors.bucket" class="text-sm text-destructive">
            {{ errors.bucket }}
          </p>
        </div>

        <div v-if="showRegion" class="space-y-2">
          <Label>{{ t("settings.connectionDialogs.region") }}</Label>
          <Select v-model="credentials.region">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('settings.connectionDialogs.selectRegion')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="r in currentRegions"
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

        <div v-if="showEndpoint" class="space-y-2">
          <Label for="endpoint">{{
            t("settings.connectionDialogs.endpointUrl")
          }}</Label>
          <Input
            id="endpoint"
            v-model="credentials.endpoint"
            placeholder="https://s3.us-west-001.backblazeb2.com"
          />
          <p v-if="errors.endpoint" class="text-sm text-destructive">
            {{ errors.endpoint }}
          </p>
        </div>

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
