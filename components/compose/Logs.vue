<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { dockerService, type DockerCompose } from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();
const { t } = useI18n();

// Compose Logs wraps ApplicationLogs in compose-mode (composeId set)
// and slots a service-picker into ApplicationLogs's header so the
// page has ONE header strip — matching the application Logs subtab's
// visual rhythm. Empty selection = aggregate stream from every
// service (the previous default behaviour); a specific selection
// scopes to `docker compose logs <svc>`.
//
// We fetch the live service list from the backend (which SSHes and
// runs `docker compose ps --services`) instead of parsing the YAML
// because that handles edge cases — partially-deployed stacks,
// services added/removed since last deploy, etc.

const services = ref<string[]>([]);
// Sentinel "__all__" maps to empty-string on the wire. The Select
// component treats "" as "no selection" which would surface the
// placeholder instead of the chosen option, so we use a non-empty
// sentinel and translate when binding to ApplicationLogs.
const selected = ref<string>("__all__");
const isLoadingServices = ref(true);

const fetchServices = async () => {
  isLoadingServices.value = true;
  try {
    const res = await dockerService.composes.listServices(
      props.compose.server_id,
      props.compose.project_id,
      props.compose.id,
    );
    services.value = res.data ?? [];
  } catch {
    // Silent on first load — the WS connection surfaces a meaningful
    // error if the host isn't reachable. The picker stays at "All
    // services" so logs still aggregate.
    services.value = [];
  } finally {
    isLoadingServices.value = false;
  }
};

const refresh = async () => {
  await fetchServices();
  toast.success(
    services.value.length
      ? t("workload.logs.servicesFound", { count: services.value.length })
      : t("workload.logs.noServices"),
  );
};

onMounted(fetchServices);
</script>

<template>
  <!--
    ApplicationLogs is the shared shell — same header (title +
    subtitle + Live pill + Clear/Pause buttons) and log surface the
    application + database Logs tabs render. We slot a service picker
    into its header-actions slot so this page reads as one strip
    instead of the previous two-strip layout that diverged from
    everything else.
  -->
  <ApplicationLogs
    :compose-id="compose.id"
    :service="selected === '__all__' ? '' : selected"
    :empty-state-message="t('workload.logs.composeEmptyDescription')"
  >
    <!--
      Slot lands inside ApplicationLogs's terminal chrome bar — dark
      background, slim height. Restyled the picker + refresh to
      match: 24px tall, transparent over the chrome with a zinc-800
      border, small refresh icon button instead of an outline
      button.
    -->
    <template #header-actions>
      <Select v-model="selected">
        <SelectTrigger
          class="h-6 min-w-[140px] border-zinc-800 bg-zinc-900 px-2 text-[11px] text-zinc-200 hover:bg-zinc-800 focus:ring-0 focus:ring-offset-0"
        >
          <SelectValue :placeholder="t('workload.logs.allServices')" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">{{
            t("workload.logs.allServices")
          }}</SelectItem>
          <SelectItem v-for="svc in services" :key="svc" :value="svc">
            {{ svc }}
          </SelectItem>
        </SelectContent>
      </Select>
      <button
        type="button"
        class="rounded p-1 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:cursor-not-allowed disabled:opacity-40"
        :title="
          isLoadingServices
            ? t('workload.logs.refreshingServices')
            : t('workload.logs.refreshServices')
        "
        :disabled="isLoadingServices"
        @click="refresh"
      >
        <Icon
          :name="isLoadingServices ? 'lucide:loader-2' : 'lucide:refresh-cw'"
          class="h-3.5 w-3.5"
          :class="isLoadingServices ? 'animate-spin' : ''"
        />
      </button>
    </template>
  </ApplicationLogs>
</template>
