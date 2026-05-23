<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Button } from "~/components/ui/button";
import {
  dockerService,
  type DockerCompose,
} from "~/services/dockerService";

interface Props {
  compose: DockerCompose;
}
const props = defineProps<Props>();

// Compose Logs wraps ApplicationLogs in compose-mode (composeId set)
// and adds a service-picker on top. Empty selection = aggregate
// stream from every service (the previous default behaviour); a
// specific selection scopes to `docker compose logs <svc>`.
//
// We fetch the live service list from the backend (which SSHes and
// runs `docker compose ps --services`) instead of parsing the YAML
// because that handles edge cases — partially-deployed stacks,
// services added/removed since last deploy, etc.

const services = ref<string[]>([]);
const selected = ref<string>("");
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
    // Silent on first load — the WS connection will surface a
    // meaningful error if the host isn't reachable. The picker just
    // stays at "All services".
    services.value = [];
  } finally {
    isLoadingServices.value = false;
  }
};

const refresh = async () => {
  await fetchServices();
  toast.success(
    services.value.length
      ? `Found ${services.value.length} service${services.value.length === 1 ? "" : "s"}`
      : "No services running yet",
  );
};

onMounted(fetchServices);
</script>

<template>
  <div class="space-y-3">
    <!--
      Service picker strip. Sits above the log stream so it reads as
      "I'm watching <this>" rather than buried inside the terminal
      frame. The Refresh button is right-aligned because services
      come from a live `docker ps` and the user might want to re-poll
      after a deploy mid-session.
    -->
    <div class="flex items-center justify-between gap-3">
      <div class="flex min-w-0 items-center gap-2">
        <Icon
          name="lucide:container"
          class="h-4 w-4 shrink-0 text-muted-foreground"
        />
        <span class="text-sm text-muted-foreground">Service:</span>
        <Select v-model="selected">
          <SelectTrigger class="h-8 min-w-[180px] text-sm">
            <SelectValue placeholder="All services" />
          </SelectTrigger>
          <SelectContent>
            <!--
              Empty value = aggregate. The Select component treats ""
              as "no selection" which surfaces the placeholder, so we
              use a sentinel value of "__all__" and translate to ""
              in the WS query. Vue's v-model on Select wraps strings
              directly — the translation lives in the prop binding
              below.
            -->
            <SelectItem value="__all__">All services</SelectItem>
            <SelectItem
              v-for="svc in services"
              :key="svc"
              :value="svc"
            >
              {{ svc }}
            </SelectItem>
          </SelectContent>
        </Select>
        <span
          v-if="isLoadingServices"
          class="text-xs text-muted-foreground"
        >
          loading…
        </span>
      </div>
      <Button variant="ghost" size="sm" @click="refresh">
        <Icon name="lucide:refresh-cw" class="mr-2 h-3.5 w-3.5" />
        Refresh
      </Button>
    </div>

    <!--
      Reuse ApplicationLogs in compose-mode. When `service` is the
      sentinel "__all__" we pass an empty string so the WS handler
      streams every container's logs (the historical default).
    -->
    <ApplicationLogs
      :compose-id="compose.id"
      :service="selected === '__all__' ? '' : selected"
      empty-state-message="Deploy this compose stack first; logs start streaming once at least one service is running."
    />
  </div>
</template>
