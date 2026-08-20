<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
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
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
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

interface DnsRecord {
  id?: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  tag?: string;
  weight?: number;
  port?: number;
  flags?: number;
  comment?: string;
  proxied?: boolean;
}

interface Domain {
  id: string;
  label: string;
  address: string;
}

interface Props {
  domain: Domain;
  record?: DnsRecord;
  availableRecordTypes: string[];
  isCloudflare?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  record: undefined,
  isCloudflare: false,
});

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const { t } = useI18n();

const isOpen = ref(false);
const isLoading = ref(false);
const selectedType = ref(props.record?.type || "A");
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const recordSchema = computed(() =>
  toTypedSchema(
    z.object({
      name: z
        .string()
        .min(1, t("operations.dns.record.validation.nameRequired")),
      value: z
        .string()
        .min(1, t("operations.dns.record.validation.valueRequired")),
      ttl: z.coerce.number().optional(),
      comment: z.string().optional(),
      proxied: z.boolean().optional(),
      priority: z.coerce.number().optional(),
      weight: z.coerce.number().optional(),
      port: z.coerce.number().optional(),
      flags: z.coerce.number().optional(),
      tag: z.string().optional(),
    }),
  ),
);

const { handleSubmit, resetForm, setFieldError, values, setFieldValue } =
  useForm({
    validationSchema: recordSchema,
    validateOnMount: false,
    initialValues: {
      name: props.record?.name || "",
      value: props.record?.value || "",
      ttl: props.record?.ttl || 3600,
      comment: props.record?.comment || "",
      proxied: props.record?.proxied || false,
      priority: props.record?.priority || 10,
      weight: props.record?.weight || 5,
      port: props.record?.port || 80,
      flags: props.record?.flags || 0,
      tag: props.record?.tag || "issue",
    },
  });

const isProxyableType = computed(() =>
  ["A", "AAAA", "CNAME"].includes(selectedType.value),
);
const showProxyToggle = computed(
  () => isProxyableType.value && props.isCloudflare,
);
const showTtlField = computed(
  () => !(values.proxied && isProxyableType.value && props.isCloudflare),
);

const proxiedField = computed({
  get: () => values.proxied ?? false,
  set: (val: boolean) => setFieldValue("proxied", val),
});

const handleClose = (open = false) => {
  isOpen.value = open;
  if (!open) {
    resetForm();
    selectedType.value = props.record?.type || "A";
  }
};

const handleTypeChange = (value: unknown) => {
  if (value != null) {
    selectedType.value = String(value);
  }
};

const onSubmit = handleSubmit(async (formValues) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: props.record
      ? t("operations.dns.record.updateConfirmationTitle")
      : t("operations.dns.record.createConfirmationTitle"),
    description: props.record
      ? t("operations.dns.record.updateConfirmationDescription")
      : t("operations.dns.record.createConfirmationDescription"),
    confirmText: props.record
      ? t("operations.dns.common.update")
      : t("operations.dns.common.create"),
    cancelText: t("operations.dns.common.cancel"),
  });

  if (!result.ok) return;

  isLoading.value = true;

  const submitData = {
    ...formValues,
    type: props.record?.type || selectedType.value,
    proxied: Boolean(formValues.proxied),
    ttl:
      formValues.proxied && isProxyableType.value && props.isCloudflare
        ? 1
        : formValues.ttl,
  };

  try {
    if (props.record?.id) {
      await $api(`/dns/domains/${props.domain.id}/records/${props.record.id}`, {
        method: "POST",
        body: submitData,
      });
      toast.success(t("operations.dns.record.updated"));
      emit("updated");
    } else {
      await $api(`/dns/domains/${props.domain.id}/records`, {
        method: "POST",
        body: submitData,
      });
      toast.success(t("operations.dns.record.created"));
      emit("created");
    }
    handleClose(false);
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        setFieldError(field as keyof typeof formValues, messages[0]);
      }
    } else {
      toast.error(err.data?.message || t("operations.dns.record.saveError"));
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <SharedConfirmationDialog ref="confirmationDialog" />
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <slot>
        <slot name="trigger">
          <Button
            v-if="record"
            variant="ghost"
            size="icon"
            class="h-8 w-8"
            :aria-label="
              t('operations.dns.record.editButtonAria', {
                type: record.type,
                name: record.name,
              })
            "
          >
            <Icon name="lucide:pencil" class="h-4 w-4" />
          </Button>
          <Button v-else>
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t("operations.dns.record.addButton") }}
          </Button>
        </slot>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {{
            record
              ? t("operations.dns.record.editTitle", { type: record.type })
              : t("operations.dns.record.createTitle", { type: selectedType })
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            record
              ? t("operations.dns.record.editDescription", {
                  domain: domain.address,
                })
              : t("operations.dns.record.createDescription", {
                  domain: domain.address,
                })
          }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <!-- Record Type Selector (only for new records) -->
        <div
          v-if="!record && availableRecordTypes.length > 0"
          class="space-y-2"
        >
          <Label>{{ t("operations.dns.record.recordType") }}</Label>
          <Select
            :model-value="selectedType"
            @update:model-value="handleTypeChange"
          >
            <SelectTrigger>
              <SelectValue
                :placeholder="t('operations.dns.record.recordTypePlaceholder')"
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="type in availableRecordTypes"
                :key="type"
                :value="type"
              >
                {{ type }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>{{ t("operations.dns.record.name") }}</FormLabel>
            <FormControl>
              <Input placeholder="@" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="value">
          <FormItem>
            <FormLabel>{{ t("operations.dns.record.value") }}</FormLabel>
            <FormControl>
              <Input placeholder="192.168.1.1" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- Proxy Toggle (Cloudflare only) -->
        <FormField v-if="showProxyToggle" name="proxied">
          <FormItem
            class="flex flex-row items-center justify-between rounded-lg border p-4"
          >
            <div class="space-y-0.5">
              <FormLabel>{{ t("operations.dns.record.proxied") }}</FormLabel>
              <FormDescription>
                {{ t("operations.dns.record.proxiedDescription") }}
              </FormDescription>
            </div>
            <FormControl>
              <Switch v-model="proxiedField" />
            </FormControl>
          </FormItem>
        </FormField>

        <!-- TTL Field -->
        <FormField v-if="showTtlField" v-slot="{ componentField }" name="ttl">
          <FormItem>
            <FormLabel>{{ t("operations.dns.record.ttlSeconds") }}</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="3600"
                :min="60"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- MX specific fields -->
        <FormField
          v-if="selectedType === 'MX'"
          v-slot="{ componentField }"
          name="priority"
        >
          <FormItem>
            <FormLabel>{{ t("operations.dns.record.priority") }}</FormLabel>
            <FormControl>
              <Input
                type="number"
                placeholder="10"
                :min="0"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <!-- SRV specific fields -->
        <template v-if="selectedType === 'SRV'">
          <FormField v-slot="{ componentField }" name="priority">
            <FormItem>
              <FormLabel>{{ t("operations.dns.record.priority") }}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="10"
                  :min="0"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="weight">
            <FormItem>
              <FormLabel>{{ t("operations.dns.record.weight") }}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="5"
                  :min="0"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="port">
            <FormItem>
              <FormLabel>{{ t("operations.dns.record.port") }}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="80"
                  :min="1"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <!-- CAA specific fields -->
        <template v-if="selectedType === 'CAA'">
          <FormField v-slot="{ componentField }" name="flags">
            <FormItem>
              <FormLabel>{{ t("operations.dns.record.flags") }}</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  placeholder="0"
                  :min="0"
                  v-bind="componentField"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>

          <FormField v-slot="{ componentField }" name="tag">
            <FormItem>
              <FormLabel>{{ t("operations.dns.record.tag") }}</FormLabel>
              <FormControl>
                <Input placeholder="issue" v-bind="componentField" />
              </FormControl>
              <FormMessage />
            </FormItem>
          </FormField>
        </template>

        <FormField v-slot="{ componentField }" name="comment">
          <FormItem>
            <FormLabel>{{
              t("operations.dns.record.commentOptional")
            }}</FormLabel>
            <FormControl>
              <Input
                :placeholder="t('operations.dns.record.commentPlaceholder')"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              record
                ? t("operations.dns.common.update")
                : t("operations.dns.common.create")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
