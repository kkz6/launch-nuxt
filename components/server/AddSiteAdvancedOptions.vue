<script setup lang="ts">
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Separator } from "~/components/ui/separator";
import { Switch } from "~/components/ui/switch";
import { Textarea } from "~/components/ui/textarea";

interface AdvancedOptions {
  create_database: boolean;
  database_option: "new" | "existing";
  database_id: string;
  database_name: string;
  database_user_option: "new" | "existing";
  database_user_id: string;
  database_user_name: string;
  database_user_password: string;
  create_scheduler: boolean;
  create_queue: boolean;
  hook_before_updating_repository: string;
  hook_after_updating_repository: string;
  hook_before_making_current: string;
  hook_after_making_current: string;
}

interface Props {
  hasDatabase: boolean;
  databases: Record<string, string>;
  databaseUsers: Record<string, string>;
  siteType: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

const options = defineModel<AdvancedOptions>({ required: true });
const isOpen = defineModel<boolean>("open", { required: true });

// Computed refs for Switch - using v-model (not v-model:checked)
const createDatabase = computed({
  get: () => options.value?.create_database ?? false,
  set: (val: boolean) => {
    if (options.value) options.value.create_database = val;
  },
});

const createScheduler = computed({
  get: () => options.value?.create_scheduler ?? false,
  set: (val: boolean) => {
    if (options.value) options.value.create_scheduler = val;
  },
});

const createQueue = computed({
  get: () => options.value?.create_queue ?? false,
  set: (val: boolean) => {
    if (options.value) options.value.create_queue = val;
  },
});

const hookModel = (
  field:
    | "hook_before_updating_repository"
    | "hook_after_updating_repository"
    | "hook_before_making_current"
    | "hook_after_making_current",
) =>
  computed({
    get: () => options.value?.[field] ?? "",
    set: (val: string) => {
      if (options.value) options.value[field] = val;
    },
  });

const hookBeforeUpdatingRepository = hookModel(
  "hook_before_updating_repository",
);
const hookAfterUpdatingRepository = hookModel("hook_after_updating_repository");
const hookBeforeMakingCurrent = hookModel("hook_before_making_current");
const hookAfterMakingCurrent = hookModel("hook_after_making_current");

const databaseOption = computed({
  get: () => options.value?.database_option ?? "new",
  set: (val: "new" | "existing") => {
    if (options.value) options.value.database_option = val;
  },
});

const databaseUserOption = computed({
  get: () => options.value?.database_user_option ?? "new",
  set: (val: "new" | "existing") => {
    if (options.value) options.value.database_user_option = val;
  },
});

const databaseName = computed({
  get: () => options.value?.database_name ?? "",
  set: (val: string) => {
    if (options.value) options.value.database_name = val;
  },
});

const databaseId = computed({
  get: () => options.value?.database_id ?? "",
  set: (val: string) => {
    if (options.value) options.value.database_id = val;
  },
});

const databaseUserName = computed({
  get: () => options.value?.database_user_name ?? "",
  set: (val: string) => {
    if (options.value) options.value.database_user_name = val;
  },
});

const databaseUserPassword = computed({
  get: () => options.value?.database_user_password ?? "",
  set: (val: string) => {
    if (options.value) options.value.database_user_password = val;
  },
});

const databaseUserId = computed({
  get: () => options.value?.database_user_id ?? "",
  set: (val: string) => {
    if (options.value) options.value.database_user_id = val;
  },
});

const hasDatabases = computed(
  () => Object.keys(props.databases || {}).length > 0,
);
const hasDatabaseUsers = computed(
  () => Object.keys(props.databaseUsers || {}).length > 0,
);

const showPassword = ref(false);

const generatePassword = () => {
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  databaseUserPassword.value = Array.from(
    crypto.getRandomValues(new Uint32Array(32)),
  )
    .map((x) => charset[x % charset.length])
    .join("");
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>{{ t("server.addSite.advancedOptions") }}</DialogTitle>
        <DialogDescription>
          {{ t("server.addSite.advancedDescription") }}
        </DialogDescription>
      </DialogHeader>

      <div class="mt-4 space-y-6">
        <!-- Database Section -->
        <div
          v-if="hasDatabase"
          class="space-y-4 border-b border-border/50 pb-4"
        >
          <h3 class="text-sm font-medium text-foreground">
            {{ t("server.addSite.database") }}
          </h3>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>{{ t("server.addSite.createDatabase") }}</Label>
              <p class="text-sm text-muted-foreground">
                {{ t("server.addSite.createDatabaseHelp") }}
              </p>
            </div>
            <Switch v-model="createDatabase" />
          </div>

          <div
            v-if="createDatabase"
            class="space-y-4 border-l-2 border-border/50 pl-4"
          >
            <!-- Database Option -->
            <div class="space-y-2">
              <Label>{{ t("server.addSite.databaseOption") }}</Label>
              <RadioGroup v-model="databaseOption" class="flex flex-row gap-4">
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="db-new" value="new" />
                  <Label for="db-new" class="font-normal">{{
                    t("server.addSite.createNewDatabase")
                  }}</Label>
                </div>
                <div v-if="hasDatabases" class="flex items-center space-x-2">
                  <RadioGroupItem id="db-existing" value="existing" />
                  <Label for="db-existing" class="font-normal">{{
                    t("server.addSite.useExistingDatabase")
                  }}</Label>
                </div>
              </RadioGroup>
            </div>

            <!-- New Database Name or Select Existing -->
            <div v-if="databaseOption === 'new'" class="space-y-2">
              <Label for="database_name">{{
                t("server.addSite.databaseName")
              }}</Label>
              <Input
                id="database_name"
                v-model="databaseName"
                :placeholder="t('server.addSite.databaseNamePlaceholder')"
              />
            </div>

            <div v-else class="space-y-2">
              <Label>{{ t("server.addSite.selectDatabase") }}</Label>
              <Select v-model="databaseId">
                <SelectTrigger>
                  <SelectValue
                    :placeholder="t('server.addSite.selectDatabase')"
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(label, value) in databases"
                    :key="value"
                    :value="String(value)"
                  >
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Separator class="my-4" />

            <!-- Database User Option -->
            <div class="space-y-2">
              <Label>{{ t("server.addSite.databaseUserOption") }}</Label>
              <RadioGroup
                v-model="databaseUserOption"
                class="flex flex-row gap-4"
              >
                <div class="flex items-center space-x-2">
                  <RadioGroupItem id="user-new" value="new" />
                  <Label for="user-new" class="font-normal">{{
                    t("server.addSite.createNewUser")
                  }}</Label>
                </div>
                <div
                  v-if="hasDatabaseUsers"
                  class="flex items-center space-x-2"
                >
                  <RadioGroupItem id="user-existing" value="existing" />
                  <Label for="user-existing" class="font-normal">{{
                    t("server.addSite.useExistingUser")
                  }}</Label>
                </div>
              </RadioGroup>
            </div>

            <!-- New User Fields or Select Existing -->
            <div v-if="databaseUserOption === 'new'" class="space-y-4">
              <div class="space-y-2">
                <Label for="database_user_name">{{
                  t("server.common.username")
                }}</Label>
                <Input
                  id="database_user_name"
                  v-model="databaseUserName"
                  :placeholder="t('server.addSite.usernamePlaceholder')"
                />
              </div>
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <Label for="database_user_password">{{
                    t("server.common.password")
                  }}</Label>
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    class="h-auto p-0 text-xs"
                    @click="generatePassword()"
                  >
                    <Icon name="lucide:braces" class="mr-1 h-3 w-3" />
                    {{ t("server.common.generatePassword") }}
                  </Button>
                </div>
                <div class="relative">
                  <Input
                    id="database_user_password"
                    v-model="databaseUserPassword"
                    :type="showPassword ? 'text' : 'password'"
                    :placeholder="t('server.addSite.passwordPlaceholder')"
                    autocomplete="new-password"
                    class="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    class="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    @click="showPassword = !showPassword"
                  >
                    <Icon
                      v-if="showPassword"
                      name="lucide:eye-off"
                      class="h-4 w-4"
                    />
                    <Icon v-else name="lucide:eye" class="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div v-else class="space-y-2">
              <Label>{{ t("server.common.selectUser") }}</Label>
              <Select v-model="databaseUserId">
                <SelectTrigger>
                  <SelectValue :placeholder="t('server.common.selectUser')" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    v-for="(label, value) in databaseUsers"
                    :key="value"
                    :value="String(value)"
                  >
                    {{ label }}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <!-- Automation Section -->
        <div class="space-y-4">
          <h3 class="text-sm font-medium text-foreground">
            {{ t("server.addSite.automation") }}
          </h3>

          <div class="flex items-center justify-between rounded-lg border p-4">
            <div class="space-y-0.5">
              <Label>{{ t("server.addSite.createScheduler") }}</Label>
              <p class="text-sm text-muted-foreground">
                {{
                  siteType === "wordpress"
                    ? t("server.addSite.wordpressCron")
                    : t("server.addSite.laravelScheduler")
                }}
              </p>
            </div>
            <Switch v-model="createScheduler" />
          </div>

          <div
            v-if="siteType === 'laravel'"
            class="flex items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <Label>{{ t("server.addSite.createQueueWorker") }}</Label>
              <p class="text-sm text-muted-foreground">
                {{ t("server.addSite.createQueueHelp") }}
              </p>
            </div>
            <Switch v-model="createQueue" />
          </div>
        </div>

        <!-- Deployment Hooks -->
        <div class="space-y-4">
          <div class="space-y-1">
            <h3 class="text-sm font-medium text-foreground">
              {{ t("server.addSite.deploymentHooks") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t("server.addSite.deploymentHooksDescription") }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="hook_before_updating_repository">{{
              t("server.addSite.beforeUpdatingRepository")
            }}</Label>
            <Textarea
              id="hook_before_updating_repository"
              v-model="hookBeforeUpdatingRepository"
              rows="2"
              class="font-mono text-xs"
              :placeholder="t('server.addSite.beforeUpdatingPlaceholder')"
            />
          </div>

          <div class="space-y-2">
            <Label for="hook_after_updating_repository">{{
              t("server.addSite.afterUpdatingRepository")
            }}</Label>
            <Textarea
              id="hook_after_updating_repository"
              v-model="hookAfterUpdatingRepository"
              rows="2"
              class="font-mono text-xs"
              placeholder="git submodule update --init --recursive"
            />
            <p class="text-xs text-muted-foreground">
              {{ t("server.addSite.submodulesHelp") }}
            </p>
          </div>

          <div class="space-y-2">
            <Label for="hook_before_making_current">{{
              t("server.addSite.beforeCurrent")
            }}</Label>
            <Textarea
              id="hook_before_making_current"
              v-model="hookBeforeMakingCurrent"
              rows="2"
              class="font-mono text-xs"
              :placeholder="t('server.addSite.beforeCurrentPlaceholder')"
            />
          </div>

          <div class="space-y-2">
            <Label for="hook_after_making_current">{{
              t("server.addSite.afterCurrent")
            }}</Label>
            <Textarea
              id="hook_after_making_current"
              v-model="hookAfterMakingCurrent"
              rows="2"
              class="font-mono text-xs"
              :placeholder="t('server.addSite.afterCurrentPlaceholder')"
            />
          </div>
        </div>
      </div>

      <DialogFooter class="mt-6">
        <Button @click="isOpen = false"> {{ t("server.common.save") }} </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
