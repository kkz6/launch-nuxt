<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "~/components/ui/sheet";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Textarea } from "~/components/ui/textarea";
import { certificateService } from "~/services/certificateService";
import type { StoredCertificate } from "~/types";

// Create-only sheet. The parent controls open/close via v-model:open so it
// can keep one Sheet instance per page and drive create vs edit through
// separate components — keeps the dialog state simple.
const emit = defineEmits<{
  created: [cert: StoredCertificate];
  // Emitted when the duplicate-fingerprint toast's "View existing" button
  // is clicked. The parent navigates the user to that cert (e.g. opens
  // the edit sheet for that ID).
  viewExisting: [id: string];
}>();

const { t } = useI18n();
const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);

const name = ref("");
const notes = ref("");
const certificate = ref("");
const privateKey = ref("");
const errors = ref<Record<string, string>>({});

const resetForm = () => {
  name.value = "";
  notes.value = "";
  certificate.value = "";
  privateKey.value = "";
  errors.value = {};
};

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const validate = () => {
  errors.value = {};
  const trimmedName = name.value.trim();
  if (!trimmedName) {
    errors.value.name = t("settings.certificates.nameRequired");
  } else if (trimmedName.length > 255) {
    errors.value.name = t("settings.certificates.nameTooLong");
  }
  if (!certificate.value.trim()) {
    errors.value.certificate = t("settings.certificates.certificateRequired");
  }
  if (!privateKey.value.trim()) {
    errors.value.private_key = t("settings.certificates.privateKeyRequired");
  }
  return Object.keys(errors.value).length === 0;
};

const onSubmit = async () => {
  if (!validate()) return;
  isLoading.value = true;
  try {
    const res = await certificateService.create({
      name: name.value.trim(),
      certificate: certificate.value,
      private_key: privateKey.value,
      ...(notes.value.trim() ? { notes: notes.value.trim() } : {}),
    });
    toast.success(t("settings.certificates.added"));
    emit("created", res.data);
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as {
      response?: { status?: number };
      data?: {
        message?: string;
        errors?: Record<string, string[]>;
        existing?: { id: string; name: string };
      };
    };
    const status = e.response?.status;

    if (status === 409 && e.data?.existing) {
      // Duplicate fingerprint — same cert already in the library. Surface
      // a "View existing" affordance so the user can jump to it.
      const existing = e.data.existing;
      toast.error(
        t("settings.certificates.duplicate", { name: existing.name }),
        {
          action: {
            label: t("settings.certificates.viewExisting"),
            onClick: () => {
              emit("viewExisting", existing.id);
              open.value = false;
            },
          },
        },
      );
    } else if (status === 422 && e.data?.errors) {
      for (const [field, messages] of Object.entries(e.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(e.data?.message || t("settings.certificates.addFailed"));
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Sheet v-model:open="open">
    <SheetContent class="w-full overflow-y-auto sm:max-w-xl">
      <SheetHeader>
        <SheetTitle>{{ t("settings.certificates.addTitle") }}</SheetTitle>
        <SheetDescription>
          {{ t("settings.certificates.addDescription") }}
        </SheetDescription>
      </SheetHeader>

      <form class="mt-6 space-y-4" @submit.prevent="onSubmit">
        <div class="space-y-1.5">
          <Label for="cert-name">{{ t("settings.certificates.name") }}</Label>
          <Input
            id="cert-name"
            v-model="name"
            :placeholder="t('settings.certificates.namePlaceholder')"
            autocomplete="off"
            maxlength="255"
          />
          <p class="text-[11px] text-muted-foreground">
            {{ t("settings.certificates.nameHelp") }}
          </p>
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="cert-notes">
            {{ t("settings.certificates.notes") }}
            <span class="text-[11px] font-normal text-muted-foreground">
              {{ t("settings.certificates.optional") }}
            </span>
          </Label>
          <Textarea
            id="cert-notes"
            v-model="notes"
            :placeholder="t('settings.certificates.notesPlaceholder')"
            class="h-20 text-sm"
          />
          <p v-if="errors.notes" class="text-sm text-destructive">
            {{ errors.notes }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="cert-pem">
            {{ t("settings.certificates.certificatePem") }}
          </Label>
          <Textarea
            id="cert-pem"
            v-model="certificate"
            placeholder="-----BEGIN CERTIFICATE-----"
            class="h-44 font-mono text-xs"
            spellcheck="false"
          />
          <p class="text-[11px] text-muted-foreground">
            {{ t("settings.certificates.certificateHelp") }}
          </p>
          <p v-if="errors.certificate" class="text-sm text-destructive">
            {{ errors.certificate }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="cert-key">
            {{ t("settings.certificates.privateKeyPem") }}
          </Label>
          <Textarea
            id="cert-key"
            v-model="privateKey"
            placeholder="-----BEGIN PRIVATE KEY-----"
            class="h-44 font-mono text-xs"
            spellcheck="false"
          />
          <p class="text-[11px] text-muted-foreground">
            {{ t("settings.certificates.privateKeyHelp") }}
          </p>
          <p v-if="errors.private_key" class="text-sm text-destructive">
            {{ errors.private_key }}
          </p>
        </div>

        <SheetFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.certificates.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.certificates.add") }}
          </Button>
        </SheetFooter>
      </form>
    </SheetContent>
  </Sheet>
</template>
