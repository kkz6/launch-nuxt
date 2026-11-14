<script setup lang="ts">
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Checkbox } from "~/components/ui/checkbox";

const { t } = useI18n();
const checkboxId = useId();

interface ConfirmationOptions {
  title: string;
  description: string;
  confirmText?: string;
  alternateConfirmText?: string;
  cancelText?: string;
  destructive?: boolean;
  warning?: string;
  inputVerificationText?: string;
  helpText?: string;
  hasInput?: boolean;
  inputType?: string;
  checkbox?: {
    label: string;
    checked: boolean;
    required?: boolean;
  };
}

interface ConfirmationResult {
  ok: boolean;
  alternate?: boolean;
  value?: string;
  checkbox?: { checked: boolean };
}

const isOpen = ref(false);
const options = ref<ConfirmationOptions>({
  title: "",
  description: "",
  confirmText: t("common.confirm"),
  cancelText: t("common.cancel"),
  destructive: false,
});
const verifiedText = ref("");
const checkboxState = ref<{ label: string; checked: boolean } | undefined>();

let resolvePromise: ((value: ConfirmationResult) => void) | null = null;

const show = (opts: ConfirmationOptions): Promise<ConfirmationResult> => {
  resolvePromise?.({ ok: false });
  options.value = {
    confirmText: t("common.confirm"),
    cancelText: t("common.cancel"),
    destructive: false,
    ...opts,
  };
  verifiedText.value = "";
  isCopied.value = false;
  checkboxState.value = opts.checkbox ? { ...opts.checkbox } : undefined;
  isOpen.value = true;
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
};

const isConfirmDisabled = computed(
  () =>
    Boolean(
      options.value.inputVerificationText &&
      options.value.inputVerificationText !== verifiedText.value,
    ) ||
    (options.value.checkbox?.required === true &&
      !checkboxState.value?.checked),
);

const finish = (result: ConfirmationResult) => {
  const resolve = resolvePromise;
  resolvePromise = null;
  isOpen.value = false;
  resolve?.(result);
};

const handleConfirm = (alternate = false) => {
  if (isConfirmDisabled.value) return;
  finish({
    ok: true,
    value: verifiedText.value || undefined,
    checkbox: checkboxState.value,
    ...(alternate ? { alternate: true } : {}),
  });
};

const handleCancel = () => {
  finish({ ok: false });
};

watch(isOpen, (open) => {
  if (!open) handleCancel();
});

const handleKeyUp = (e: KeyboardEvent) => {
  if (e.key === "Enter" && !options.value.alternateConfirmText) {
    handleConfirm();
  }
};

const isCopied = ref(false);
const copyVerificationText = async () => {
  if (options.value.inputVerificationText) {
    await navigator.clipboard.writeText(options.value.inputVerificationText);
    isCopied.value = true;
    setTimeout(() => {
      isCopied.value = false;
    }, 2000);
  }
};

defineExpose({ show });
</script>

<template>
  <AlertDialog v-model:open="isOpen">
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{{ options.title }}</AlertDialogTitle>
        <AlertDialogDescription>{{
          options.description
        }}</AlertDialogDescription>

        <div
          v-if="options.warning"
          class="mt-3 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/10 dark:text-red-400"
        >
          <div class="flex items-start gap-2">
            <Icon
              name="lucide:triangle-alert"
              class="mt-0.5 h-4 w-4 shrink-0"
            />
            <p>{{ options.warning }}</p>
          </div>
        </div>

        <section
          v-if="
            options.inputVerificationText ||
            options.hasInput ||
            options.checkbox
          "
          class="pt-4 text-sm"
        >
          <div class="grid w-full items-center gap-3">
            <Label
              v-if="options.helpText"
              for="verification"
              class="text-foreground"
              >{{ options.helpText }}</Label
            >

            <div
              v-if="options.inputVerificationText"
              class="flex items-center justify-between gap-2 rounded-md border bg-muted px-3 py-2"
            >
              <span class="select-all font-mono text-sm text-foreground">
                {{ options.inputVerificationText }}
              </span>
              <button
                type="button"
                class="flex flex-shrink-0 items-center justify-center rounded p-1 text-muted-foreground transition-colors hover:bg-background hover:text-foreground"
                @click="copyVerificationText"
              >
                <Icon
                  :name="isCopied ? 'lucide:check' : 'lucide:copy'"
                  :class="[
                    'block h-4 w-4 transition-all duration-200',
                    isCopied && 'text-green-500',
                  ]"
                />
              </button>
            </div>

            <Input
              v-if="options.inputVerificationText || options.hasInput"
              id="verification"
              v-model="verifiedText"
              :type="options.inputType || 'text'"
              :placeholder="
                options.inputVerificationText ? t('common.typeToConfirm') : ''
              "
              class="w-full"
              @keyup="handleKeyUp"
            />

            <div v-if="checkboxState" class="flex items-start gap-2">
              <Checkbox
                :id="checkboxId"
                :model-value="checkboxState.checked"
                :aria-required="options.checkbox?.required"
                class="mt-0.5"
                @update:model-value="checkboxState.checked = $event === true"
              />
              <Label :for="checkboxId" class="cursor-pointer leading-snug">
                {{ checkboxState.label }}
              </Label>
            </div>
          </div>
        </section>
      </AlertDialogHeader>
      <AlertDialogFooter :class="{ 'gap-2': options.alternateConfirmText }">
        <AlertDialogCancel
          :class="{ 'mt-0': options.alternateConfirmText }"
          @click="handleCancel"
        >
          {{ options.cancelText }}
        </AlertDialogCancel>
        <AlertDialogAction
          v-if="options.alternateConfirmText"
          :disabled="isConfirmDisabled"
          class="border border-input bg-background text-foreground shadow-sm hover:bg-accent hover:text-accent-foreground"
          @click="handleConfirm(true)"
        >
          {{ options.alternateConfirmText }}
        </AlertDialogAction>
        <AlertDialogAction
          :disabled="isConfirmDisabled"
          :class="{
            'bg-destructive text-destructive-foreground hover:bg-destructive/90':
              options.destructive,
          }"
          @click="handleConfirm()"
        >
          {{ options.confirmText }}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
</template>
