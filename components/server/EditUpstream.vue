<script setup lang="ts">
import { toast } from "vue-sonner";
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
import type { LoadBalancerUpstream } from "~/types";
import { serverService } from "~/services/serverService";

interface Props {
  serverId: string;
  upstream: LoadBalancerUpstream;
}

const props = defineProps<Props>();
const { t } = useI18n();
const emit = defineEmits<{
  updated: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);

// Form values
const name = ref(props.upstream.name);
const lbPolicy = ref(props.upstream.lb_policy);
const healthCheckPath = ref(props.upstream.health_check_path);
const healthCheckInterval = ref(props.upstream.health_check_interval);
const healthCheckTimeout = ref(props.upstream.health_check_timeout);

const lbPolicies = computed(() => [
  { value: "round_robin", label: t("server.upstream.roundRobin") },
  { value: "least_conn", label: t("server.upstream.leastConnections") },
  { value: "ip_hash", label: t("server.upstream.ipHash") },
  { value: "first", label: t("server.upstream.firstAvailable") },
  { value: "random", label: t("server.upstream.random") },
]);

const resetForm = () => {
  name.value = props.upstream.name;
  lbPolicy.value = props.upstream.lb_policy;
  healthCheckPath.value = props.upstream.health_check_path;
  healthCheckInterval.value = props.upstream.health_check_interval;
  healthCheckTimeout.value = props.upstream.health_check_timeout;
};

const onSubmit = async () => {
  isLoading.value = true;
  try {
    await serverService.loadBalancer.upstreams.update(
      props.serverId,
      props.upstream.id,
      {
        name: name.value.trim(),
        lb_policy: lbPolicy.value,
        health_check_path: healthCheckPath.value.trim(),
        health_check_interval: healthCheckInterval.value.trim(),
        health_check_timeout: healthCheckTimeout.value.trim(),
      },
    );
    toast.success(t("server.upstream.updated"));
    emit("updated");
    isOpen.value = false;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.upstream.updateFailed"));
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
      <Button variant="ghost" size="icon" class="h-8 w-8">
        <Icon name="lucide:pencil" class="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ t("server.upstream.edit") }}</DialogTitle>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="edit-name">{{ t("server.common.name") }}</Label>
          <Input id="edit-name" v-model="name" />
        </div>

        <div class="space-y-2">
          <Label>{{ t("server.upstream.domain") }}</Label>
          <Input :model-value="upstream.address" disabled class="bg-muted" />
          <p class="text-xs text-muted-foreground">
            {{ t("server.upstream.domainImmutable") }}
          </p>
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
        </div>

        <div class="space-y-2">
          <Label for="edit-health-path">{{
            t("server.upstream.healthCheckPath")
          }}</Label>
          <Input
            id="edit-health-path"
            v-model="healthCheckPath"
            placeholder="/"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-health-interval">{{
              t("server.upstream.checkInterval")
            }}</Label>
            <Input
              id="edit-health-interval"
              v-model="healthCheckInterval"
              placeholder="30s"
            />
          </div>
          <div class="space-y-2">
            <Label for="edit-health-timeout">{{
              t("server.upstream.checkTimeout")
            }}</Label>
            <Input
              id="edit-health-timeout"
              v-model="healthCheckTimeout"
              placeholder="10s"
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("server.upstream.update") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
