<script setup lang="ts">
// Shared stored-certificate picker. Used by both the PHP site SSL
// dialog (UpdateSsl.vue) and the Docker domain dialog
// (CreateDomain.vue). The picker reads the team's stored cert
// library on mount and surfaces expiry colouring so users don't
// pick a cert that's about to expire.
//
// Empty-state guides the user to Settings → Connections → SSL
// Certificates to create one — there's no inline create here to
// keep this component focused.

import { differenceInDays, formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { certificateService } from "~/services/certificateService";
import type { StoredCertificate } from "~/types";

interface Props {
  modelValue: string | null | undefined;
  disabled?: boolean;
}

const props = defineProps<Props>();
const { locale, t } = useI18n();

const emit = defineEmits<{
  "update:modelValue": [value: string | null];
}>();

const certificates = ref<StoredCertificate[]>([]);
const isLoading = ref(true);

const fetchCertificates = async () => {
  isLoading.value = true;
  try {
    const response = await certificateService.list();
    certificates.value = response.data || [];
  } catch {
    certificates.value = [];
  } finally {
    isLoading.value = false;
  }
};

onMounted(fetchCertificates);

// Mirror the colouring rules used by Settings → Connections SSL
// Certificates so the picker and the library agree on what's
// "expiring soon" vs "expired".
const expiryClasses = (notAfter: string) => {
  const daysUntil = differenceInDays(new Date(notAfter), new Date());
  if (daysUntil < 0) return "text-destructive";
  if (daysUntil <= 30) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
};

const expiryLabel = (notAfter: string) => {
  const date = new Date(notAfter);
  const daysUntil = differenceInDays(date, new Date());
  const relative = formatDistanceToNow(date, {
    addSuffix: true,
    locale: locale.value === "ja" ? ja : enUS,
  });
  return daysUntil < 0
    ? t("shared.certificatePicker.expired", { relative })
    : t("shared.certificatePicker.expires", { relative });
};

const primaryDomain = (cert: StoredCertificate) => {
  return cert.domains?.[0] || cert.common_name || cert.name;
};

// Select needs a string model — wrap the prop so the wire format
// stays nullable (null = nothing picked) while the Select sees a
// concrete string.
const selectedId = computed({
  get: () => props.modelValue ?? "",
  set: (value: string) => emit("update:modelValue", value || null),
});
</script>

<template>
  <div class="space-y-2">
    <div v-if="isLoading" class="text-sm text-muted-foreground">
      {{ t("shared.certificatePicker.loading") }}
    </div>

    <div
      v-else-if="certificates.length === 0"
      class="rounded-md border p-4 text-sm text-muted-foreground"
    >
      {{ t("shared.certificatePicker.empty") }}
      <NuxtLink
        to="/settings/connections#ssl-certificates"
        class="font-medium text-primary hover:underline"
      >
        {{ t("shared.certificatePicker.addInSettings") }}
      </NuxtLink>
      {{ t("shared.certificatePicker.returnHint") }}
    </div>

    <Select v-else v-model="selectedId" :disabled="disabled">
      <SelectTrigger>
        <SelectValue :placeholder="t('shared.certificatePicker.placeholder')" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectItem
            v-for="cert in certificates"
            :key="cert.id"
            :value="cert.id"
          >
            <div class="flex flex-col">
              <span class="font-medium">{{ cert.name }}</span>
              <span class="text-xs" :class="expiryClasses(cert.not_after)">
                {{ primaryDomain(cert) }} · {{ expiryLabel(cert.not_after) }}
              </span>
            </div>
          </SelectItem>
        </SelectGroup>
      </SelectContent>
    </Select>
  </div>
</template>
