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
const { t } = useI18n();
const { setCurrentTeamId } = useApi();
const { refreshActiveTeam } = useActiveTeamRefresh();
const { teams, loading, loadTeams } = useTeams();
const createOpen = ref(false);
const repeatedNames = computed(() => duplicateTeamNames(teams.value));

const localizedTeamQualifier = (team: Team) => {
  const [qualifier, suffix] = teamQualifier(
    team,
    String(user.value?.id || ""),
    repeatedNames.value,
  ).split(" · ");
  const qualifierKey = qualifier.toLowerCase();
  const label = ["personal", "owned", "joined"].includes(qualifierKey)
    ? t(`common.teams.${qualifierKey}`)
    : qualifier;
  return suffix ? `${label} · ${suffix}` : label;
};

const fetchTeams = async () => {
  try {
    await loadTeams();
  } catch {
    toast.error(t("common.teams.loadFailed"));
  }
};

const switchTeam = async (teamId: string) => {
  if (teamId === String(user.value?.current_team_id)) return;
  const team = teams.value.find((item) => item.id === teamId);
  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    setCurrentTeamId(teamId);
    await fetchUser();
    refreshActiveTeam();
    await navigateTo("/dashboard");
    toast.success(
      t("common.teams.switched", {
        team: team?.name || t("common.teams.defaultName"),
      }),
    );
  } catch {
    toast.error(t("common.teams.switchFailed"));
  }
};

void fetchTeams();
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
            {{ localizedTeamQualifier(team) }}
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
        <span>{{ t("common.teams.new") }}</span>
      </DropdownMenuItem>
    </DropdownMenuGroup>
    <SettingsCreateTeam v-model:open="createOpen" @created="loadTeams(true)" />
  </template>
</template>
