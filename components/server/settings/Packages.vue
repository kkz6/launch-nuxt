<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Separator } from "~/components/ui/separator";

interface Credential {
  url: string;
  username: string;
  password: string;
}

interface CredentialErrors {
  url?: string;
  username?: string;
  password?: string;
}

interface ComposerConfig {
  "http-basic": Record<string, { username: string; password: string }>;
}

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const credentials = ref<Credential[]>([]);
const errors = ref<CredentialErrors[]>([]);
const isLoading = ref(true);
const isSaving = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchComposerConfig = async () => {
  isLoading.value = true;
  try {
    const data = await $api<{ data: { composer: ComposerConfig } }>(
      `/servers/${props.serverId}/packages`,
    );
    const composer = data.data?.composer || { "http-basic": {} };
    credentials.value = Object.entries(composer["http-basic"] || {}).map(
      ([url, { username, password }]) => ({
        url,
        username,
        password,
      }),
    );
    errors.value = credentials.value.map(() => ({}));
  } catch {
    toast.error(t("server.settings.packages.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const validateUrl = (url: string): boolean => {
  if (!url) return false;
  const validPatterns = [
    /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&/=]*)$/,
    /^packagist\.org$/,
    /^repo\.packagist\.org$/,
    /^gitlab\.com$/,
    /^github\.com$/,
  ];
  return validPatterns.some((pattern) => pattern.test(url));
};

const validateCredential = (credential: Credential): CredentialErrors => {
  const credentialErrors: CredentialErrors = {};

  if (!credential.url) {
    credentialErrors.url = t("server.settings.packages.urlRequired");
  } else if (!validateUrl(credential.url)) {
    credentialErrors.url = t("server.settings.packages.urlInvalid");
  }

  if (!credential.username) {
    credentialErrors.username = t("server.settings.packages.usernameRequired");
  }

  if (!credential.password) {
    credentialErrors.password = t("server.settings.packages.passwordRequired");
  }

  return credentialErrors;
};

const addCredential = () => {
  credentials.value.push({ url: "", username: "", password: "" });
  errors.value.push({});
};

const removeCredential = (index: number) => {
  credentials.value.splice(index, 1);
  errors.value.splice(index, 1);
};

const buildComposerJson = () => {
  const httpBasic = credentials.value.reduce(
    (acc, { url, username, password }) => {
      if (url) {
        acc[url] = { username, password };
      }
      return acc;
    },
    {} as Record<string, { username: string; password: string }>,
  );

  return JSON.stringify({ "http-basic": httpBasic }, null, 2);
};

const updateCredential = (
  index: number,
  field: keyof Credential,
  value: string,
) => {
  credentials.value[index][field] = value;
  if (errors.value[index]?.[field]) {
    delete errors.value[index][field];
  }
};

const saveConfig = async () => {
  // Validate all credentials
  const newErrors: CredentialErrors[] = [];
  let hasErrors = false;

  credentials.value.forEach((credential, index) => {
    const credentialErrors = validateCredential(credential);
    newErrors[index] = credentialErrors;
    if (Object.keys(credentialErrors).length > 0) {
      hasErrors = true;
    }
  });

  errors.value = newErrors;

  if (hasErrors) {
    toast.error(t("server.settings.packages.validationError"));
    return;
  }

  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.settings.packages.updateTitle"),
    description: t("server.settings.packages.updateDescription"),
    confirmText: t("server.common.update"),
    cancelText: t("server.common.cancel"),
  });

  if (!result.ok) return;

  isSaving.value = true;
  try {
    await $api(`/servers/${props.serverId}/packages`, {
      method: "PATCH",
      body: { contents: buildComposerJson() },
    });
    toast.success(t("server.settings.packages.updated"));
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(
      err.data?.message || t("server.settings.packages.updateFailed"),
    );
  } finally {
    isSaving.value = false;
  }
};

onMounted(fetchComposerConfig);
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div>
      <h3 class="text-lg font-medium">
        {{ t("server.settings.packages.title") }}
      </h3>
      <p class="text-sm text-muted-foreground">
        {{ t("server.settings.packages.description") }}
      </p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div
        v-if="credentials.length === 0"
        class="flex items-center gap-3 rounded-lg border bg-muted/50 p-4"
      >
        <Icon
          name="lucide:info"
          class="h-5 w-5 flex-shrink-0 text-muted-foreground"
        />
        <p class="text-sm text-muted-foreground">
          {{ t("server.settings.packages.empty") }}
        </p>
      </div>

      <div class="space-y-6">
        <div
          v-for="(credential, index) in credentials"
          :key="index"
          class="space-y-4"
        >
          <Separator v-if="index > 0" />

          <div class="grid grid-cols-1 items-end gap-4 sm:grid-cols-3">
            <div class="space-y-2 sm:col-span-2">
              <Label :for="`url-${index}`">{{
                t("server.settings.packages.repositoryUrl")
              }}</Label>
              <Input
                :id="`url-${index}`"
                :model-value="credential.url"
                placeholder="e.g., repo.packagist.org"
                :class="{ 'border-destructive': errors[index]?.url }"
                @update:model-value="
                  updateCredential(index, 'url', String($event))
                "
              />
              <p v-if="errors[index]?.url" class="text-sm text-destructive">
                {{ errors[index].url }}
              </p>
            </div>
            <Button
              variant="outline"
              class="w-full sm:w-auto sm:justify-self-end"
              @click="removeCredential(index)"
            >
              <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
              {{ t("server.common.remove") }}
            </Button>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div class="space-y-2">
              <Label :for="`username-${index}`">{{
                t("server.common.username")
              }}</Label>
              <Input
                :id="`username-${index}`"
                :model-value="credential.username"
                :placeholder="t('server.common.username')"
                :class="{ 'border-destructive': errors[index]?.username }"
                @update:model-value="
                  updateCredential(index, 'username', String($event))
                "
              />
              <p
                v-if="errors[index]?.username"
                class="text-sm text-destructive"
              >
                {{ errors[index].username }}
              </p>
            </div>
            <div class="space-y-2">
              <Label :for="`password-${index}`">{{
                t("server.common.password")
              }}</Label>
              <Input
                :id="`password-${index}`"
                type="password"
                :model-value="credential.password"
                :placeholder="t('server.common.password')"
                :class="{ 'border-destructive': errors[index]?.password }"
                @update:model-value="
                  updateCredential(index, 'password', String($event))
                "
              />
              <p
                v-if="errors[index]?.password"
                class="text-sm text-destructive"
              >
                {{ errors[index].password }}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div class="flex gap-3">
        <Button variant="outline" @click="addCredential">
          <Icon name="lucide:plus" class="mr-2 block size-4" />
          {{ t("server.settings.packages.addCredential") }}
        </Button>
        <Button :disabled="isSaving" @click="saveConfig">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 block size-4 animate-spin"
          />
          <Icon v-else name="lucide:save" class="mr-2 block size-4" />
          {{ t("server.settings.packages.saveConfiguration") }}
        </Button>
      </div>
    </template>
  </div>
</template>
