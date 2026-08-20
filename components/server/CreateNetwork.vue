<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { RadioGroup, RadioGroupItem } from "~/components/ui/radio-group";
import type { FirewallRule } from "~/types";

interface Props {
  serverId: string;
  firewallRule?: FirewallRule | null;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const actions = computed<Record<string, string>>(() => ({
  allow: t("server.networkRule.allow"),
  deny: t("server.networkRule.deny"),
}));

// Form values
const name = ref("");
const action = ref<"allow" | "deny">("allow");
const port = ref("");
const fromIpv4 = ref("");

const isEditMode = computed(() => !!props.firewallRule);

const isSSHRule = computed(() => {
  if (!props.firewallRule) return false;
  return (
    props.firewallRule.name.toLowerCase() === "ssh" ||
    props.firewallRule.port === "22"
  );
});

const hasPortChanged = computed(() => {
  if (!props.firewallRule) return false;
  return port.value.trim() !== props.firewallRule.port;
});

const hasRuleChanged = computed(() => {
  if (!props.firewallRule) return false;
  return (
    port.value.trim() !== props.firewallRule.port ||
    action.value !== props.firewallRule.action ||
    (fromIpv4.value.trim() || null) !== (props.firewallRule.from_ipv4 || null)
  );
});

const getSchema = () =>
  z.object({
    name: z.string().min(1, t("server.networkRule.nameRequired")).max(255),
    action: z.enum(["allow", "deny"]),
    port: z.string().min(1, t("server.networkRule.portRequired")),
    from_ipv4: z.string().optional(),
  });

const canSubmit = computed(() => {
  return (
    name.value.trim().length > 0 &&
    port.value.trim().length > 0 &&
    !isLoading.value
  );
});

const resetForm = () => {
  name.value = props.firewallRule?.name || "";
  action.value = (props.firewallRule?.action as "allow" | "deny") || "allow";
  port.value = props.firewallRule?.port || "";
  fromIpv4.value = props.firewallRule?.from_ipv4 || "";
  errors.value = {};
};

const validate = () => {
  const result = getSchema().safeParse({
    name: name.value.trim(),
    action: action.value,
    port: port.value.trim(),
    from_ipv4: fromIpv4.value.trim() || undefined,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      port: fieldErrors.port?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const updateServerSSHPort = async (newPort: string) => {
  try {
    await $api(`/servers/${props.serverId}`, {
      method: "PATCH",
      body: { ssh_port: parseInt(newPort, 10) },
    });
  } catch {
    toast.error(t("server.networkRule.sshPortUpdateFailed"));
  }
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  if (!confirmationDialog.value) return;

  // Build confirmation message
  let description = isEditMode.value
    ? t("server.networkRule.updateConfirm")
    : t("server.networkRule.createConfirm");

  if (isEditMode.value && isSSHRule.value && hasPortChanged.value) {
    description = t("server.networkRule.sshPortConfirm", {
      oldPort: props.firewallRule!.port,
      newPort: port.value.trim(),
    });
  }

  const result = await confirmationDialog.value.show({
    title: isEditMode.value
      ? t("server.networkRule.updateTitle")
      : t("server.networkRule.createTitle"),
    description,
    confirmText: isEditMode.value
      ? t("server.common.update")
      : t("server.common.create"),
    cancelText: t("server.common.cancel"),
    destructive: isEditMode.value && isSSHRule.value && hasPortChanged.value,
  });

  if (!result.ok) return;

  isLoading.value = true;
  try {
    if (isEditMode.value && props.firewallRule) {
      if (hasRuleChanged.value) {
        // Port, action, or IP changed — create new rule first, then delete old
        await $api(`/servers/${props.serverId}/firewall-rules`, {
          method: "POST",
          body: data,
        });
        await $api(
          `/servers/${props.serverId}/firewall-rules/${props.firewallRule.id}`,
          {
            method: "DELETE",
          },
        );

        // Update server SSH port if this is the SSH rule and port changed
        if (isSSHRule.value && hasPortChanged.value) {
          await updateServerSSHPort(data.port);
        }
      } else {
        // Only name changed — server route is registered as PUT
        // (UpdateNested), not PATCH; sending PATCH used to come back
        // 405 Method Not Allowed and the UI toasted a generic
        // "Failed to update firewall rule".
        await $api(
          `/servers/${props.serverId}/firewall-rules/${props.firewallRule.id}`,
          {
            method: "PUT",
            body: { name: data.name },
          },
        );
      }
      toast.success(t("server.networkRule.updated"));
      emit("updated");
    } else {
      await $api(`/servers/${props.serverId}/firewall-rules`, {
        method: "POST",
        body: data,
      });
      toast.success(t("server.networkRule.created"));
      emit("created");
    }
    isOpen.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.common.errorOccurred"));
  } finally {
    isLoading.value = false;
  }
};

watch(isOpen, (open) => {
  if (open) {
    resetForm();
  }
});

defineExpose({
  open: () => {
    isOpen.value = true;
  },
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:network" class="mr-2 h-4 w-4" />
          {{
            firewallRule
              ? t("server.networkRule.edit")
              : t("server.networkRule.add")
          }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-3xl">
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>{{
          firewallRule
            ? t("server.networkRule.updateTitle")
            : t("server.networkRule.createTitle")
        }}</DialogTitle>
      </DialogHeader>

      <!-- SSH port warning -->
      <div
        v-if="isEditMode && isSSHRule && hasPortChanged"
        class="rounded-md border border-amber-500/50 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200"
      >
        <div class="flex items-start gap-2">
          <Icon name="lucide:triangle-alert" class="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {{ t("server.networkRule.sshPortWarning") }}
          </p>
        </div>
      </div>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="name">{{ t("server.common.name") }}</Label>
          <Input
            id="name"
            v-model="name"
            :placeholder="t('server.networkRule.namePlaceholder')"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label>{{ t("server.common.action") }}</Label>
          <RadioGroup v-model="action" class="flex gap-4">
            <div
              v-for="(label, value) in actions"
              :key="value"
              class="flex items-center space-x-2"
            >
              <RadioGroupItem :id="`action-${value}`" :value="value" />
              <Label :for="`action-${value}`" class="font-normal">{{
                label
              }}</Label>
            </div>
          </RadioGroup>
        </div>

        <div class="space-y-2">
          <Label for="port">{{ t("server.networkRule.port") }}</Label>
          <Input
            id="port"
            v-model="port"
            :placeholder="t('server.networkRule.portPlaceholder')"
          />
          <p v-if="errors.port" class="text-sm text-destructive">
            {{ errors.port }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="from_ipv4">{{ t("server.networkRule.fromIp") }}</Label>
          <Input
            id="from_ipv4"
            v-model="fromIpv4"
            :placeholder="t('server.networkRule.fromIpPlaceholder')"
          />
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              firewallRule
                ? t("server.common.update")
                : t("server.common.create")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
