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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface DnsProvider {
  id: string;
  provider: string;
  // The API returns the human label as `provider_label`; older callers
  // pass `label`. Accept either so the dropdown never renders blank.
  provider_label?: string;
  label?: string;
}

interface Props {
  providers?: DnsProvider[];
}

const props = withDefaults(defineProps<Props>(), {
  providers: () => [],
});

const emit = defineEmits<{
  created: [];
}>();

const { locale, t } = useI18n();

const isOpen = ref(false);
const isLoading = ref(false);
const localProviders = ref<DnsProvider[]>([]);
const isProvidersLoading = ref(false);
const errors = ref<Record<string, string>>({});
const hasClientValidationErrors = ref(false);

// Form values
const label = ref("");
const address = ref("");
const provider = ref("");

const schema = computed(() =>
  z.object({
    label: z.string().min(1, t("operations.dns.add.validation.labelRequired")),
    address: z
      .string()
      .min(1, t("operations.dns.add.validation.addressRequired")),
    provider: z
      .string()
      .min(1, t("operations.dns.add.validation.providerRequired")),
  }),
);

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (label.value.trim().length === 0) return false;
  if (address.value.trim().length === 0) return false;
  if (provider.value.length === 0) return false;
  return true;
});

const resetForm = () => {
  label.value = "";
  address.value = "";
  provider.value = "";
  errors.value = {};
  hasClientValidationErrors.value = false;
};

const validate = () => {
  const result = schema.value.safeParse({
    label: label.value.trim(),
    address: address.value.trim(),
    provider: provider.value,
  });
  if (!result.success) {
    hasClientValidationErrors.value = true;
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      label: fieldErrors.label?.[0] || "",
      address: fieldErrors.address?.[0] || "",
      provider: fieldErrors.provider?.[0] || "",
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

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    await $api("/dns/domains", {
      method: "POST",
      body: data,
    });
    toast.success(t("operations.dns.add.success"));
    isOpen.value = false;
    resetForm();
    emit("created");
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
      toast.error(err.data?.message || t("operations.dns.add.error"));
    }
  } finally {
    isLoading.value = false;
  }
};

// Fetch providers when dialog opens if not provided
watch(isOpen, async (open) => {
  if (
    open &&
    props.providers.length === 0 &&
    localProviders.value.length === 0
  ) {
    isProvidersLoading.value = true;
    try {
      const response = await $api<{ data: { providers: DnsProvider[] } }>(
        "/dns/domains",
      );
      localProviders.value = response.data.providers;
    } catch {
      // Silent fail
    } finally {
      isProvidersLoading.value = false;
    }
  } else if (!open) {
    resetForm();
  }
});

const availableProviders = computed(() =>
  props.providers.length > 0 ? props.providers : localProviders.value,
);

const providerOptions = computed(() =>
  availableProviders.value.map((p) => ({
    value: p.id,
    label:
      p.provider_label ||
      p.label ||
      p.provider ||
      t("operations.dns.common.unknownProvider"),
  })),
);
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button
          class="px-2.5 sm:px-4"
          :aria-label="t('operations.dns.add.buttonAria')"
        >
          <Icon name="lucide:plus" class="h-4 w-4 sm:mr-2" />
          <span class="hidden sm:inline">{{
            t("operations.dns.add.button")
          }}</span>
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>{{ t("operations.dns.add.title") }}</DialogTitle>
        <DialogDescription>
          {{ t("operations.dns.add.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="label">{{ t("operations.dns.add.label") }}</Label>
          <Input
            id="label"
            v-model="label"
            :placeholder="t('operations.dns.add.labelPlaceholder')"
          />
          <p v-if="errors.label" class="text-sm text-destructive">
            {{ errors.label }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="address">{{ t("operations.dns.add.address") }}</Label>
          <Input
            id="address"
            v-model="address"
            :placeholder="t('operations.dns.add.addressPlaceholder')"
          />
          <p v-if="errors.address" class="text-sm text-destructive">
            {{ errors.address }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="provider">{{ t("operations.dns.add.provider") }}</Label>
          <Select v-model="provider">
            <SelectTrigger>
              <SelectValue
                :placeholder="t('operations.dns.add.providerPlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="option in providerOptions"
                :key="option.value"
                :value="option.value"
              >
                {{ option.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.provider" class="text-sm text-destructive">
            {{ errors.provider }}
          </p>
        </div>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("operations.dns.add.button") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
