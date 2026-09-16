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
} from "~/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
  phpConfigurationService,
  type PhpConfigurationKind,
} from "~/services/phpConfigurationService";

interface PhpService {
  id: string;
  name: string;
  version: string;
}

interface Props {
  serverId: string;
  service: PhpService;
}

interface EditorFile {
  label: string;
  path: string;
  contents: string;
  savedContents: string;
  loaded: boolean;
  loading: boolean;
  error: string;
}

const props = defineProps<Props>();
const open = defineModel<boolean>("open", { required: true });
const emit = defineEmits<{ saved: [] }>();
const { t } = useI18n();
const { canEdit } = useCan();

const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const activeTab = ref<PhpConfigurationKind>("php_ini");
const configurationKinds: PhpConfigurationKind[] = ["php_ini", "php_fpm"];
const isSaving = ref(false);
const files = reactive<Record<PhpConfigurationKind, EditorFile>>({
  php_ini: {
    label: "php.ini",
    path: "",
    contents: "",
    savedContents: "",
    loaded: false,
    loading: false,
    error: "",
  },
  php_fpm: {
    label: "php-fpm.conf",
    path: "",
    contents: "",
    savedContents: "",
    loaded: false,
    loading: false,
    error: "",
  },
});

const activeFile = computed(() => files[activeTab.value]);
const activeContent = computed({
  get: () => activeFile.value.contents,
  set: (value: string) => {
    activeFile.value.contents = value;
  },
});
const isDirty = computed(() =>
  Object.values(files).some(
    (file) => file.loaded && file.contents !== file.savedContents,
  ),
);
const isActiveFileDirty = computed(
  () =>
    activeFile.value.loaded &&
    activeFile.value.contents !== activeFile.value.savedContents,
);

const resetFiles = () => {
  for (const file of Object.values(files)) {
    file.path = "";
    file.contents = "";
    file.savedContents = "";
    file.loaded = false;
    file.loading = false;
    file.error = "";
  }
};

const errorMessage = (error: unknown, fallback: string) =>
  (error as { data?: { message?: string } })?.data?.message || fallback;

const loadFile = async (kind: PhpConfigurationKind) => {
  const file = files[kind];
  if (file.loaded || file.loading) return;

  file.loading = true;
  file.error = "";
  try {
    const response = await phpConfigurationService.get(
      props.serverId,
      props.service.id,
      kind,
    );
    file.label = response.data.label;
    file.path = response.data.path;
    file.contents = response.data.contents;
    file.savedContents = response.data.contents;
    file.loaded = true;
  } catch (error: unknown) {
    file.error = errorMessage(
      error,
      t("server.settings.phpConfiguration.loadFailed"),
    );
  } finally {
    file.loading = false;
  }
};

const saveActiveFile = async () => {
  if (!canEdit.value || !isActiveFileDirty.value || isSaving.value) return;
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("server.settings.phpConfiguration.saveTitle", {
      file: activeFile.value.label,
    }),
    description: t("server.settings.phpConfiguration.saveDescription", {
      file: activeFile.value.label,
      version: props.service.version,
    }),
    confirmText: t("server.settings.phpConfiguration.saveAndReload"),
    cancelText: t("server.common.cancel"),
  });
  if (!result.ok) return;

  isSaving.value = true;
  activeFile.value.error = "";
  try {
    const response = await phpConfigurationService.update(
      props.serverId,
      props.service.id,
      activeTab.value,
      activeFile.value.contents,
    );
    activeFile.value.contents = response.data.contents;
    activeFile.value.savedContents = response.data.contents;
    activeFile.value.path = response.data.path;
    toast.success(t("server.settings.phpConfiguration.saved"));
    emit("saved");
  } catch (error: unknown) {
    activeFile.value.error = errorMessage(
      error,
      t("server.settings.phpConfiguration.saveFailed"),
    );
    toast.error(activeFile.value.error);
  } finally {
    isSaving.value = false;
  }
};

const requestClose = async () => {
  if (isSaving.value) return;
  if (isDirty.value && confirmationDialog.value) {
    const result = await confirmationDialog.value.show({
      title: t("server.settings.phpConfiguration.discardTitle"),
      description: t("server.settings.phpConfiguration.discardDescription"),
      confirmText: t("server.settings.phpConfiguration.discardChanges"),
      cancelText: t("server.common.cancel"),
      destructive: true,
    });
    if (!result.ok) return;
  }
  open.value = false;
};

const handleOpenChange = (nextOpen: boolean) => {
  if (nextOpen) {
    open.value = true;
    return;
  }
  void requestClose();
};

watch(
  open,
  (isOpen) => {
    if (!isOpen) return;
    activeTab.value = "php_ini";
    resetFiles();
    void loadFile("php_ini");
  },
  { immediate: true },
);

watch(activeTab, (kind) => {
  if (open.value) void loadFile(kind);
});
</script>

<template>
  <SharedConfirmationDialog ref="confirmationDialog" />

  <Dialog :open="open" @update:open="handleOpenChange">
    <DialogContent
      class="flex h-[min(82vh,760px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
    >
      <DialogHeader class="border-b px-6 pb-4 pt-6">
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:file-cog" class="h-5 w-5" />
          {{
            t("server.settings.phpConfiguration.title", {
              version: service.version,
            })
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("server.settings.phpConfiguration.description") }}
        </DialogDescription>
      </DialogHeader>

      <Tabs v-model="activeTab" class="flex min-h-0 flex-1 flex-col">
        <div class="border-b px-6 pt-3">
          <TabsList class="h-auto bg-transparent p-0">
            <TabsTrigger
              value="php_ini"
              class="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              php.ini
              <span
                v-if="
                  files.php_ini.loaded &&
                  files.php_ini.contents !== files.php_ini.savedContents
                "
                class="ml-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                :aria-label="t('server.settings.phpConfiguration.unsaved')"
              />
            </TabsTrigger>
            <TabsTrigger
              value="php_fpm"
              class="rounded-none border-b-2 border-transparent px-4 py-3 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
            >
              php-fpm.conf
              <span
                v-if="
                  files.php_fpm.loaded &&
                  files.php_fpm.contents !== files.php_fpm.savedContents
                "
                class="ml-2 h-1.5 w-1.5 rounded-full bg-amber-500"
                :aria-label="t('server.settings.phpConfiguration.unsaved')"
              />
            </TabsTrigger>
          </TabsList>
        </div>

        <div class="flex min-h-0 flex-1 flex-col">
          <div
            class="flex min-h-10 items-center gap-2 border-b bg-muted/30 px-6 py-2 text-xs text-muted-foreground"
          >
            <Icon name="lucide:server" class="h-3.5 w-3.5 shrink-0" />
            <code class="break-all">{{
              activeFile.path || activeFile.label
            }}</code>
          </div>

          <TabsContent
            v-for="kind in configurationKinds"
            :key="kind"
            :value="kind"
            class="relative m-0 min-h-0 flex-1 data-[state=inactive]:hidden"
          >
            <div
              v-if="files[kind].loading"
              class="flex h-full items-center justify-center"
            >
              <Icon
                name="lucide:loader-2"
                class="h-6 w-6 animate-spin text-muted-foreground"
              />
            </div>
            <div
              v-else-if="files[kind].error && !files[kind].loaded"
              class="flex h-full flex-col items-center justify-center gap-3 px-6 text-center"
            >
              <Icon
                name="lucide:triangle-alert"
                class="h-6 w-6 text-destructive"
              />
              <p class="max-w-lg text-sm text-muted-foreground">
                {{ files[kind].error }}
              </p>
              <Button variant="outline" size="sm" @click="loadFile(kind)">
                <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
                {{ t("server.common.retry") }}
              </Button>
            </div>
            <SharedCodeEditor
              v-else-if="files[kind].loaded"
              v-model="activeContent"
              class="h-full"
              :disabled="!canEdit"
              :line-numbers="true"
              :fold-gutter="true"
              :line-wrapping="true"
            />
          </TabsContent>
        </div>
      </Tabs>

      <div
        v-if="activeFile.error && activeFile.loaded"
        role="alert"
        class="flex items-start gap-2 border-t border-destructive/30 bg-destructive/5 px-6 py-3 text-sm text-destructive"
      >
        <Icon name="lucide:triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
        <span>{{ activeFile.error }}</span>
      </div>

      <DialogFooter
        class="border-t px-6 py-4 sm:items-center sm:justify-between"
      >
        <p class="text-left text-xs text-muted-foreground">
          {{
            canEdit
              ? t("server.settings.phpConfiguration.validationNote")
              : t("server.settings.phpConfiguration.readOnlyNote")
          }}
        </p>
        <div class="flex justify-end gap-2">
          <Button variant="outline" :disabled="isSaving" @click="requestClose">
            {{ t("server.common.close") }}
          </Button>
          <Button
            v-if="canEdit"
            :disabled="
              activeFile.loading ||
              !activeFile.loaded ||
              !isActiveFileDirty ||
              isSaving
            "
            @click="saveActiveFile"
          >
            <Icon
              :name="isSaving ? 'lucide:loader-2' : 'lucide:save'"
              class="mr-2 h-4 w-4"
              :class="isSaving && 'animate-spin'"
            />
            {{ t("server.settings.phpConfiguration.saveAndReload") }}
          </Button>
        </div>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
