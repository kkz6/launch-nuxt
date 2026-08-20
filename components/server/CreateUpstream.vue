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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Checkbox } from "~/components/ui/checkbox";
import type { CheckDomainResponse } from "~/types";
import { serverService } from "~/services/serverService";

interface Props {
  serverId: string;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  created: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);
const isCheckingDomain = ref(false);
const errors = ref<Record<string, string>>({});
const domainCheck = ref<CheckDomainResponse | null>(null);

// Form values
const name = ref("");
const address = ref("");
const lbPolicy = ref("round_robin");
const healthCheckPath = ref("/");
const autoAddExistingSites = ref(false);

// Debounce timer for domain check
let domainCheckTimer: ReturnType<typeof setTimeout> | null = null;

const lbPolicies = computed(() => [
  { value: "round_robin", label: t("server.upstream.roundRobin") },
  { value: "least_conn", label: t("server.upstream.leastConnections") },
  { value: "ip_hash", label: t("server.upstream.ipHash") },
  { value: "first", label: t("server.upstream.firstAvailable") },
  { value: "random", label: t("server.upstream.random") },
]);

const getSchema = () =>
  z.object({
    name: z.string().min(1, t("server.upstream.nameRequired")).max(255),
    address: z.string().min(1, t("server.upstream.domainRequired")),
    lb_policy: z.enum([
      "round_robin",
      "least_conn",
      "ip_hash",
      "first",
      "random",
    ]),
    health_check_path: z.string().optional(),
    auto_add_existing_sites: z.boolean().optional(),
  });

const canSubmit = computed(() => {
  return (
    name.value.trim().length > 0 &&
    address.value.trim().length > 0 &&
    !isLoading.value
  );
});

const resetForm = () => {
  name.value = "";
  address.value = "";
  lbPolicy.value = "round_robin";
  healthCheckPath.value = "/";
  autoAddExistingSites.value = false;
  errors.value = {};
  domainCheck.value = null;
};

const checkDomain = async () => {
  const addr = address.value.trim();
  if (!addr) {
    domainCheck.value = null;
    return;
  }

  isCheckingDomain.value = true;
  try {
    const response = await serverService.loadBalancer.checkDomain(
      props.serverId,
      addr,
    );
    domainCheck.value = response.data;
  } catch {
    domainCheck.value = null;
  } finally {
    isCheckingDomain.value = false;
  }
};

// Debounced domain check on address change
watch(address, () => {
  if (domainCheckTimer) clearTimeout(domainCheckTimer);
  domainCheckTimer = setTimeout(checkDomain, 500);
});

const validate = () => {
  const result = getSchema().safeParse({
    name: name.value.trim(),
    address: address.value.trim(),
    lb_policy: lbPolicy.value,
    health_check_path: healthCheckPath.value.trim() || undefined,
    auto_add_existing_sites: autoAddExistingSites.value,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      name: fieldErrors.name?.[0] || "",
      address: fieldErrors.address?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    await serverService.loadBalancer.upstreams.create(props.serverId, data);
    toast.success(t("server.upstream.created"));
    emit("created");
    isOpen.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.upstream.createFailed"));
  } finally {
    isLoading.value = false;
  }
};

watch(isOpen, (open) => {
  if (!open) resetForm();
});
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          {{ t("server.upstream.add") }}
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t("server.upstream.create") }}</DialogTitle>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="upstream-name">{{ t("server.common.name") }}</Label>
          <Input
            id="upstream-name"
            v-model="name"
            :placeholder="t('server.upstream.namePlaceholder')"
          />
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="upstream-address">{{
            t("server.upstream.domain")
          }}</Label>
          <div class="relative">
            <Input
              id="upstream-address"
              v-model="address"
              :placeholder="t('server.upstream.domainPlaceholder')"
            />
            <Icon
              v-if="isCheckingDomain"
              name="lucide:loader-2"
              class="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          </div>
          <p v-if="errors.address" class="text-sm text-destructive">
            {{ errors.address }}
          </p>

          <!-- Domain check result -->
          <div
            v-if="domainCheck?.exists"
            class="rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30"
          >
            <p class="text-sm font-medium text-amber-800 dark:text-amber-400">
              <Icon name="lucide:alert-triangle" class="mr-1 inline h-4 w-4" />
              {{ t("server.upstream.existingSites") }}
            </p>
            <p
              v-if="domainCheck.warning"
              class="mt-1 text-sm text-amber-700 dark:text-amber-500"
            >
              {{ domainCheck.warning }}
            </p>
            <ul v-if="domainCheck.sites" class="mt-2 space-y-1">
              <li
                v-for="site in domainCheck.sites"
                :key="site.id"
                class="text-sm text-amber-700 dark:text-amber-500"
              >
                {{
                  t("server.upstream.existingSite", {
                    address: site.address,
                    type: site.type,
                    server: site.server_id.slice(0, 8),
                  })
                }}
              </li>
            </ul>
            <div class="mt-2 flex items-center gap-2">
              <Checkbox
                id="auto-add"
                :checked="autoAddExistingSites"
                @update:checked="autoAddExistingSites = $event as boolean"
              />
              <Label
                for="auto-add"
                class="text-sm font-normal text-amber-700 dark:text-amber-500"
              >
                {{ t("server.upstream.autoAddSites") }}
              </Label>
            </div>
          </div>
        </div>

        <div class="space-y-2">
          <Label>{{ t("server.upstream.policy") }}</Label>
          <Select v-model="lbPolicy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="policy in lbPolicies"
                :key="policy.value"
                :value="policy.value"
              >
                {{ policy.label }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p
            v-if="lbPolicy === 'ip_hash'"
            class="text-xs text-muted-foreground"
          >
            {{ t("server.upstream.ipHashHelp") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="health-check-path">{{
            t("server.upstream.healthCheckPath")
          }}</Label>
          <Input
            id="health-check-path"
            v-model="healthCheckPath"
            placeholder="/"
          />
          <p class="text-xs text-muted-foreground">
            {{ t("server.upstream.healthCheckHelp") }}
          </p>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("server.upstream.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
