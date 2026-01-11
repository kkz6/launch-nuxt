<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

definePageMeta({
  layout: "settings",
  middleware: "auth",
});

useHead({ title: "Teams" });

interface Team {
  id: string;
  name: string;
  personal_team: boolean;
  image_url?: string;
  owner?: {
    id: string;
    name: string;
    email: string;
  };
  users_count?: number;
  created_at: string;
}

const { user } = useAuth();
const teams = ref<Team[]>([]);
const isLoading = ref(true);

const currentTeam = computed(() =>
  teams.value.find((t) => t.id === String(user.value?.current_team_id))
);

const fetchTeams = async () => {
  try {
    const response = await $api<{ data: Team[] }>("/teams");
    teams.value = response.data;
  } catch {
    toast.error("Failed to load teams");
  } finally {
    isLoading.value = false;
  }
};

const switchTeam = async (teamId: string) => {
  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    window.location.reload();
  } catch {
    toast.error("Failed to switch team");
  }
};

onMounted(fetchTeams);
</script>

<template>
  <div class="w-full">
    <Card class="h-full bg-transparent">
      <CardHeader>
        <div class="flex items-center justify-between">
          <div>
            <CardTitle class="text-xl">Teams</CardTitle>
            <CardDescription>
              Manage your teams and team memberships
            </CardDescription>
          </div>
          <SettingsCreateTeam @created="fetchTeams" />
        </div>
      </CardHeader>
      <CardContent class="flex flex-col gap-4">
        <div v-if="isLoading" class="flex items-center justify-center py-8">
          <Icon
            name="lucide:loader-2"
            class="h-6 w-6 animate-spin text-muted-foreground"
          />
        </div>

        <template v-else>
          <div v-if="teams.length === 0" class="py-8 text-center">
            <Icon
              name="lucide:users"
              class="mx-auto mb-4 h-12 w-12 text-muted-foreground"
            />
            <p class="text-muted-foreground">No teams found</p>
          </div>

          <div v-else class="space-y-4">
            <Card
              v-for="team in teams"
              :key="team.id"
              :class="[
                'transition-colors',
                team.id === currentTeam?.id
                  ? 'border-primary bg-muted/30'
                  : 'bg-transparent',
              ]"
            >
              <CardContent class="flex items-center justify-between p-4">
                <div class="flex items-center gap-3">
                  <Avatar class="h-10 w-10">
                    <AvatarImage :src="team.image_url || ''" :alt="team.name" />
                    <AvatarFallback>
                      {{ team.name.charAt(0).toUpperCase() }}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div class="flex items-center gap-2">
                      <h4 class="font-medium">{{ team.name }}</h4>
                      <Badge
                        v-if="team.personal_team"
                        variant="secondary"
                        class="text-xs"
                      >
                        Personal
                      </Badge>
                      <Badge
                        v-if="team.id === currentTeam?.id"
                        variant="default"
                        class="text-xs"
                      >
                        Current
                      </Badge>
                    </div>
                    <p v-if="team.users_count" class="text-sm text-muted-foreground">
                      {{ team.users_count }}
                      {{ team.users_count === 1 ? "member" : "members" }}
                    </p>
                  </div>
                </div>
                <div class="flex items-center gap-2">
                  <Button
                    v-if="team.id !== currentTeam?.id"
                    variant="outline"
                    size="sm"
                    @click="switchTeam(team.id)"
                  >
                    Switch
                  </Button>
                  <NuxtLink :to="`/settings/teams/${team.id}`">
                    <Button variant="ghost" size="sm">
                      <Icon name="lucide:settings" class="h-4 w-4" />
                    </Button>
                  </NuxtLink>
                </div>
              </CardContent>
            </Card>
          </div>
        </template>
      </CardContent>
    </Card>
  </div>
</template>
