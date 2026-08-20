<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
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
import { Switch } from "~/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface Script {
  id: string;
  name: string;
  run_as: "root" | "local";
  content: string;
  team_id: string | null;
}

interface Props {
  script?: Script;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const { locale, t } = useI18n();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});
const hasClientValidationErrors = ref(false);
const codeEditorRef = ref<InstanceType<
  typeof import("~/components/shared/CodeEditor.vue").default
> | null>(null);

const { user: authUser } = useAuth();
const teamId = computed(
  () => authUser.value?.current_team_id?.toString() || null,
);

// Form values
const name = ref(props.script?.name || "");
const runAs = ref<"root" | "local">(props.script?.run_as || "root");
const content = ref(props.script?.content || "");
const shareWithTeam = ref(props.script?.team_id !== null);

const schema = computed(() =>
  z.object({
    name: z
      .string()
      .min(1, t("operations.scripts.create.validation.nameRequired"))
      .max(255),
    content: z
      .string()
      .min(1, t("operations.scripts.create.validation.contentRequired")),
    run_as: z.enum(["root", "local"]),
  }),
);

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (name.value.trim().length === 0) return false;
  if (content.value.trim().length === 0) return false;
  return true;
});

const resetForm = () => {
  name.value = props.script?.name || "";
  runAs.value = props.script?.run_as || "root";
  content.value = props.script?.content || "";
  shareWithTeam.value = props.script?.team_id !== null;
  errors.value = {};
  hasClientValidationErrors.value = false;
};

const validate = () => {
  const result = schema.value.safeParse({
    name: name.value.trim(),
    content: content.value,
    run_as: runAs.value,
  });
  if (!result.success) {
    hasClientValidationErrors.value = true;
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      content: fieldErrors.content?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  hasClientValidationErrors.value = false;
  return result.data;
};

watch(locale, () => {
  if (hasClientValidationErrors.value) validate();
});

// Insert variable at cursor position in code editor
const insertVariable = (variable: string) => {
  codeEditorRef.value?.insertAtCursor(variable);
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    const isEdit = !!props.script;
    const url = isEdit ? `/scripts/${props.script!.id}` : "/scripts";

    await $api(url, {
      method: isEdit ? "PUT" : "POST",
      body: {
        name: data.name,
        run_as: data.run_as,
        content: data.content,
        team_id: shareWithTeam.value ? teamId.value : null,
      },
    });

    toast.success(
      isEdit
        ? t("operations.scripts.create.updated")
        : t("operations.scripts.create.created"),
    );
    open.value = false;
    resetForm();
    if (isEdit) {
      emit("updated");
    } else {
      emit("created");
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      hasClientValidationErrors.value = false;
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message ||
          t(
            props.script
              ? "operations.scripts.create.updateError"
              : "operations.scripts.create.createError",
          ),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

// Placeholder variables info
const variablesInfo = [
  {
    var: "{{server_id}}",
    labelKey: "operations.scripts.create.variables.serverId",
    icon: "lucide:hash",
  },
  {
    var: "{{server_name}}",
    labelKey: "operations.scripts.create.variables.serverName",
    icon: "lucide:server",
  },
  {
    var: "{{ip_address}}",
    labelKey: "operations.scripts.create.variables.publicIp",
    icon: "lucide:globe",
  },
  {
    var: "{{private_ip_address}}",
    labelKey: "operations.scripts.create.variables.privateIp",
    icon: "lucide:network",
  },
  {
    var: "{{username}}",
    labelKey: "operations.scripts.create.variables.username",
    icon: "lucide:user",
  },
  {
    var: "{{db_password}}",
    labelKey: "operations.scripts.create.variables.databasePassword",
    icon: "lucide:key",
  },
  {
    var: "{{server_type}}",
    labelKey: "operations.scripts.create.variables.serverType",
    icon: "lucide:layers",
  },
];
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button
        class="px-2.5 sm:px-4"
        :aria-label="t('operations.scripts.create.buttonAria')"
      >
        <Icon name="lucide:plus" class="h-4 w-4 sm:mr-2" />
        <span class="hidden sm:inline">{{
          t("operations.scripts.create.button")
        }}</span>
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {{
            script
              ? t("operations.scripts.create.updateTitle")
              : t("operations.scripts.create.createTitle")
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            script
              ? t("operations.scripts.create.updateDescription")
              : t("operations.scripts.create.createDescription")
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="name">{{ t("operations.scripts.create.name") }}</Label>
            <Input
              id="name"
              v-model="name"
              :placeholder="t('operations.scripts.create.namePlaceholder')"
            />
            <p v-if="errors.name" class="text-sm text-destructive">
              {{ errors.name }}
            </p>
          </div>

          <div class="space-y-2">
            <Label>{{ t("operations.scripts.common.runAs") }}</Label>
            <Select v-model="runAs">
              <SelectTrigger>
                <SelectValue
                  :placeholder="t('operations.scripts.create.userPlaceholder')"
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="root">{{
                  t("operations.scripts.common.root")
                }}</SelectItem>
                <SelectItem value="local">{{
                  t("operations.scripts.common.captain")
                }}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <Label>{{ t("operations.scripts.create.script") }}</Label>
            <span class="text-xs text-muted-foreground">
              {{ t("operations.scripts.create.insertHint") }}
            </span>
          </div>
          <SharedCodeEditor
            ref="codeEditorRef"
            v-model="content"
            placeholder="#!/bin/bash&#10;&#10;apt update && apt upgrade -y"
            :line-numbers="true"
            :fold-gutter="false"
            class="h-[240px]"
          />
          <p v-if="errors.content" class="text-sm text-destructive">
            {{ errors.content }}
          </p>
        </div>

        <!-- Variables -->
        <div class="space-y-2">
          <Label class="text-muted-foreground">
            {{ t("operations.scripts.create.availableVariables") }}
          </Label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="v in variablesInfo"
              :key="v.var"
              type="button"
              class="inline-flex items-center gap-1.5 rounded-md border bg-background px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-muted hover:border-primary/50"
              :title="
                t('operations.scripts.create.insertVariable', {
                  label: t(v.labelKey),
                })
              "
              @click="insertVariable(v.var)"
            >
              <Icon :name="v.icon" class="h-3.5 w-3.5 text-muted-foreground" />
              <span class="font-mono">{{ v.var }}</span>
            </button>
          </div>
        </div>

        <!-- Team sharing toggle -->
        <div class="flex items-center justify-between rounded-lg border p-3">
          <div>
            <p class="text-sm font-medium">
              {{ t("operations.scripts.create.shareWithTeam") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("operations.scripts.create.shareWithTeamDescription") }}
            </p>
          </div>
          <Switch v-model="shareWithTeam" />
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            {{ t("operations.scripts.common.cancel") }}
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              script
                ? t("operations.scripts.common.update")
                : t("operations.scripts.common.create")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
