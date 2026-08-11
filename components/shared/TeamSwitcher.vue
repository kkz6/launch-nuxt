<script setup lang="ts">
import { Check, Plus } from "lucide-vue-next";
import { toast } from "vue-sonner";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
} from "~/components/ui/dropdown-menu";
import type { Team } from "~/types";
import { duplicateTeamNames, teamQualifier } from "~/utils/teams";

const { user, fetchUser } = useAuth();
const { setCurrentTeamId } = useApi();
const { reconnect } = useWebSocket();
const teams = ref<Team[]>([]);
const loading = ref(true);
const createOpen = ref(false);
const refreshKey = useState("teamsRefreshKey", () => 0);
const repeatedNames = computed(() => duplicateTeamNames(teams.value));

const fetchTeams = async () => {
  try {
    const response = await $api<{ data: Team[] }>("/teams");
    teams.value = response.data;
  } catch {
    teams.value = [];
  } finally {
    loading.value = false;
  }
};

const switchTeam = async (teamId: string) => {
  if (teamId === String(user.value?.current_team_id)) return;
  const team = teams.value.find((item) => item.id === teamId);
  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    setCurrentTeamId(teamId);
    await fetchUser();
    reconnect();
    useState("serversRefreshKey", () => 0).value++;
    useState("dashboardRefreshKey", () => 0).value++;
    useState("scriptsRefreshKey", () => 0).value++;
    useState("dnsRefreshKey", () => 0).value++;
    await navigateTo("/dashboard");
    toast.success(`Switched to ${team?.name || "team"}`);
  } catch {
    toast.error("Failed to switch team");
  }
};

onMounted(fetchTeams);
watch(refreshKey, fetchTeams);
</script>

<template>
  <div v-if="loading" class="flex items-center justify-center py-2">
    <Icon
      name="lucide:loader-2"
      class="h-3 w-3 animate-spin text-muted-foreground"
    />
  </div>
  <template v-else>
    <DropdownMenuGroup>
      <DropdownMenuItem
        v-for="team in teams"
        :key="team.id"
        class="cursor-pointer justify-between gap-2 rounded-md px-2 py-1.5 text-sm"
        @click="switchTeam(team.id)"
      >
        <span class="min-w-0 flex-1">
          <span class="block truncate">{{ team.name }}</span>
          <span class="block truncate text-[11px] text-muted-foreground">
            {{ teamQualifier(team, String(user?.id || ""), repeatedNames) }}
          </span>
        </span>
        <Check
          v-if="team.id === String(user?.current_team_id)"
          class="h-3.5 w-3.5 text-primary"
        />
      </DropdownMenuItem>
      <DropdownMenuItem
        class="cursor-pointer gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
        @click="createOpen = true"
      >
        <Plus class="h-3.5 w-3.5" />
        <span>New team</span>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <SettingsCreateTeam v-model:open="createOpen" @created="fetchTeams" />
  </template>
</template>
