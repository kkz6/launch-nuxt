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

interface FileInfo {
  id: string;
  name: string;
  path: string;
}

interface Props {
  serverId: string;
  file: FileInfo;
  title?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: undefined,
});
const { t } = useI18n();
const dialogTitle = computed(
  () => props.title || t("server.settings.configEditor.title"),
);

const emit = defineEmits<{
  saved: [];
}>();

const open = defineModel<boolean>("open", { required: true });

const content = ref("");
const isLoading = ref(true);
const isSaving = ref(false);

watch(open, async (isOpen) => {
  if (isOpen) {
    await fetchContent();
  }
});

const fetchContent = async () => {
  isLoading.value = true;
  try {
    const data = await $api<{ content: string }>(
      `/servers/${props.serverId}/files/${props.file.id}`,
    );
    content.value = data.content || "";
  } catch {
    toast.error(t("server.settings.configEditor.loadFailed"));
    open.value = false;
  } finally {
    isLoading.value = false;
  }
};

const handleSave = async () => {
  isSaving.value = true;
  try {
    await $api(`/servers/${props.serverId}/files/${props.file.id}`, {
      method: "PUT",
      body: { content: content.value },
    });
    toast.success(t("server.settings.configEditor.saved"));
    emit("saved");
    open.value = false;
  } catch {
    toast.error(t("server.settings.configEditor.saveFailed"));
  } finally {
    isSaving.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent
      class="flex h-[80vh] max-h-[700px] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl"
    >
      <DialogHeader class="border-b px-6 pb-4 pt-6">
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:file-code" class="h-5 w-5" />
          {{ dialogTitle }}
        </DialogTitle>
        <DialogDescription>
          {{ file.path }}
        </DialogDescription>
      </DialogHeader>

      <div class="flex-1 overflow-hidden">
        <div v-if="isLoading" class="flex h-full items-center justify-center">
          <Icon
            name="lucide:loader-2"
            class="h-6 w-6 animate-spin text-muted-foreground"
          />
        </div>
        <SharedCodeEditor
          v-else
          v-model="content"
          class="h-full"
          :line-numbers="true"
          :fold-gutter="true"
          :line-wrapping="true"
        />
      </div>

      <DialogFooter class="border-t px-6 py-4">
        <Button variant="outline" :disabled="isSaving" @click="open = false">
          {{ t("server.common.cancel") }}
        </Button>
        <Button :disabled="isLoading || isSaving" @click="handleSave">
          <Icon
            v-if="isSaving"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          <Icon v-else name="lucide:save" class="mr-2 h-4 w-4" />
          {{ t("server.settings.general.saveChanges") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
