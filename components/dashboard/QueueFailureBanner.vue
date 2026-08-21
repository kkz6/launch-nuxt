<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "~/components/ui/alert";

interface FailedQueue {
  id: string;
  name: string;
  connection: string;
  site_id: string;
  site_name: string;
  server_id: string;
  server_name: string;
  last_status_check: string | null;
}

const props = defineProps<{
  queues: FailedQueue[];
}>();

const { t } = useI18n();
const visibleQueues = computed(() => props.queues.slice(0, 3));
const remainingCount = computed(() =>
  Math.max(props.queues.length - visibleQueues.value.length, 0),
);
</script>

<template>
  <Alert v-if="queues.length > 0" variant="destructive">
    <Icon name="lucide:triangle-alert" class="h-4 w-4" />
    <AlertTitle>
      {{ t("public.dashboard.queueFailure.title", { count: queues.length }) }}
    </AlertTitle>
    <AlertDescription class="mt-2">
      <p>{{ t("public.dashboard.queueFailure.description") }}</p>
      <div class="mt-3 flex flex-wrap items-center gap-2">
        <NuxtLink
          v-for="queue in visibleQueues"
          :key="queue.id"
          :to="`/servers/${queue.server_id}/sites/${queue.site_id}?tab=queues`"
          class="rounded-md border border-destructive/30 bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          {{ queue.site_name }} · {{ queue.name }}
        </NuxtLink>
        <span v-if="remainingCount > 0" class="text-xs">
          {{ t("public.dashboard.queueFailure.more", { count: remainingCount }) }}
        </span>
      </div>
    </AlertDescription>
  </Alert>
</template>
