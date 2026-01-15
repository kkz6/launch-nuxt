<script setup lang="ts">
import { toast } from "vue-sonner";
import {
  ChevronsUpDown,
  LogOut,
  Rocket,
  Settings,
  Plus,
  Trash2,
  Check,
  Sun,
  Moon,
  Monitor,
} from "lucide-vue-next";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";

interface Team {
  id: string;
  name: string;
  personal_team: boolean;
  image_url?: string;
}

const { user, logout } = useAuth();
const { open: openSettingsSheet } = useSettingsSheet();
const colorMode = useColorMode();

const setColorMode = (mode: "light" | "dark" | "system") => {
  colorMode.preference = mode;
  if (mode === "dark") {
    document.documentElement.classList.add("dark");
  } else if (mode === "light") {
    document.documentElement.classList.remove("dark");
  } else {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }
};

const isOpen = ref(false);
const isTeamOpen = ref(false);
const isCreateTeamOpen = ref(false);
const teams = ref<Team[]>([]);
const isTeamsLoading = ref(true);
const confirmationDialog = ref<InstanceType<typeof import("~/components/shared/ConfirmationDialog.vue").default> | null>(null);

const currentTeam = computed(() =>
  teams.value.find((t) => t.id === String(user.value?.current_team_id))
);

const fetchTeams = async () => {
  try {
    const response = await $api<{ data: Team[] }>("/teams");
    teams.value = response.data;
  } catch {
    // Silent fail
  } finally {
    isTeamsLoading.value = false;
  }
};

const switchTeam = async (teamId: string) => {
  if (teamId === String(user.value?.current_team_id)) return;
  try {
    await $api(`/teams/${teamId}/switch`, { method: "POST" });
    window.location.reload();
  } catch {
    toast.error("Failed to switch team");
  }
};

const deleteTeam = async (team: Team) => {
  if (!confirmationDialog.value) return;
  if (team.personal_team) {
    toast.error("Cannot delete personal team");
    return;
  }

  const result = await confirmationDialog.value.show({
    title: "Delete Team",
    description: `Are you sure you want to delete "${team.name}"? This action cannot be undone and will remove all team data.`,
    confirmText: "Delete Team",
    cancelText: "Cancel",
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/teams/${team.id}`, { method: "DELETE" });
      teams.value = teams.value.filter((t) => t.id !== team.id);
      toast.success("Team deleted");
      if (team.id === String(user.value?.current_team_id)) {
        window.location.reload();
      }
    } catch {
      toast.error("Failed to delete team");
    }
  }
};

const canDeleteTeam = (team: Team) => {
  return !team.personal_team;
};

const getTeamInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const openSettings = () => {
  isOpen.value = false;
  openSettingsSheet();
};

const userInitials = computed(() => {
  if (!user.value?.name) return "U";
  return user.value.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
});

const handleLogout = async () => {
  isOpen.value = false;
  await logout();
};

const navigateTo = (path: string) => {
  isOpen.value = false;
  useRouter().push(path);
};

const onTeamCreated = () => {
  fetchTeams();
};

onMounted(fetchTeams);
</script>

<template>
  <nav
    class="sticky top-0 z-40 w-full border-b border-divider bg-background/70 backdrop-blur-lg"
  >
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div
      class="mx-auto flex h-16 max-w-8xl items-center justify-between px-4 sm:px-6"
    >
      <NuxtLink to="/servers" class="flex items-center gap-2">
        <span class="text-xl font-bold">Launch</span>
      </NuxtLink>

      <div class="flex items-center space-x-2">
        <!-- Team Switcher -->
        <ClientOnly>
          <DropdownMenu v-model:open="isTeamOpen">
            <DropdownMenuTrigger as-child>
              <button
                class="flex h-9 items-center gap-2 rounded-lg border border-border bg-background/50 px-3 text-sm font-medium shadow-sm transition-all duration-150 hover:bg-accent/10 hover:shadow-md"
              >
                <Avatar class="h-5 w-5">
                  <AvatarImage v-if="currentTeam?.image_url" :src="currentTeam.image_url" />
                  <AvatarFallback class="text-[10px]">
                    {{ currentTeam ? getTeamInitials(currentTeam.name) : '?' }}
                  </AvatarFallback>
                </Avatar>
                <span class="hidden max-w-[120px] truncate sm:inline">
                  {{ currentTeam?.name || 'Select Team' }}
                </span>
                <ChevronsUpDown class="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-64">
              <DropdownMenuLabel class="text-xs font-medium text-muted-foreground">
                Teams
              </DropdownMenuLabel>

              <div v-if="isTeamsLoading" class="flex items-center justify-center py-4">
                <Icon name="lucide:loader-2" class="h-4 w-4 animate-spin text-muted-foreground" />
              </div>

              <template v-else>
                <DropdownMenuItem
                  v-for="team in teams"
                  :key="team.id"
                  class="cursor-pointer justify-between gap-2 px-2 py-2"
                  @click="switchTeam(team.id)"
                >
                  <div class="flex items-center gap-2">
                    <Avatar class="h-6 w-6">
                      <AvatarImage v-if="team.image_url" :src="team.image_url" />
                      <AvatarFallback class="text-[10px]">
                        {{ getTeamInitials(team.name) }}
                      </AvatarFallback>
                    </Avatar>
                    <span class="truncate">{{ team.name }}</span>
                  </div>
                  <div class="flex items-center gap-1">
                    <Check
                      v-if="team.id === String(user?.current_team_id)"
                      class="h-4 w-4 text-primary"
                    />
                    <button
                      v-if="canDeleteTeam(team)"
                      class="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      @click.stop="deleteTeam(team)"
                    >
                      <Trash2 class="h-3.5 w-3.5" />
                    </button>
                  </div>
                </DropdownMenuItem>
              </template>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="cursor-pointer gap-2 px-2 py-2"
                @click="isCreateTeamOpen = true"
              >
                <Plus class="h-4 w-4 text-muted-foreground" />
                <span>Create Team</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div class="flex h-9 w-32 animate-pulse items-center gap-2 rounded-lg border border-border bg-background/50 px-3">
              <div class="h-5 w-5 rounded-full bg-muted" />
              <div class="h-4 flex-1 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>

        <!-- User Menu -->
        <ClientOnly>
          <DropdownMenu v-model:open="isOpen">
            <DropdownMenuTrigger as-child>
              <div
                class="flex h-9 cursor-pointer items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm transition-all duration-150 hover:bg-accent/10 hover:shadow-md sm:pr-1.5"
              >
                <Avatar class="h-8 w-8 border-2 border-background shadow-sm">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-xs font-medium sm:text-sm">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>

                <span
                  class="ml-0.5 mr-2 hidden max-w-[150px] truncate text-sm font-medium sm:inline"
                >
                  {{ user?.name }}
                </span>

                <ChevronsUpDown class="h-4 w-4 text-muted-foreground" />
              </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" class="w-[280px] sm:w-64">
              <DropdownMenuLabel
                class="flex items-center gap-2 px-2 py-3 sm:py-2"
              >
                <Avatar class="h-10 w-10 sm:hidden">
                  <AvatarImage :src="user?.profile_photo_url || ''" />
                  <AvatarFallback class="text-sm font-medium">
                    {{ userInitials }}
                  </AvatarFallback>
                </Avatar>
                <div class="flex flex-col">
                  <span class="text-sm font-semibold">{{ user?.name }}</span>
                  <span class="text-xs text-muted-foreground">{{
                    user?.email
                  }}</span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />

              <DropdownMenuGroup>
                <DropdownMenuItem
                  v-if="user?.onboarded"
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="navigateTo('/onboarding')"
                >
                  <Rocket class="h-4 w-4 text-muted-foreground" />
                  <span>Onboarding</span>
                </DropdownMenuItem>
                <DropdownMenuItem
                  class="cursor-pointer gap-2 px-2 py-2.5 sm:py-2"
                  @click="openSettings"
                >
                  <Settings class="h-4 w-4 text-muted-foreground" />
                  <span>Settings</span>
                </DropdownMenuItem>
              </DropdownMenuGroup>
              <DropdownMenuSeparator />

              <!-- Theme Switcher -->
              <div class="px-2 py-2">
                <div class="flex items-center justify-between">
                  <span class="text-sm text-muted-foreground">Theme</span>
                  <div class="flex items-center gap-1 rounded-lg border bg-muted/50 p-1">
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'light' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('light')"
                    >
                      <Sun class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'dark' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('dark')"
                    >
                      <Moon class="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      class="rounded-md p-1.5 transition-colors"
                      :class="colorMode.preference === 'system' ? 'bg-background shadow-sm' : 'text-muted-foreground hover:text-foreground'"
                      @click.stop="setColorMode('system')"
                    >
                      <Monitor class="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                class="cursor-pointer gap-2 px-2 py-2.5 text-destructive focus:text-destructive sm:py-2"
                @click="handleLogout"
              >
                <LogOut class="h-4 w-4" />
                <span>Sign Out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <template #fallback>
            <div
              class="flex h-9 animate-pulse items-center gap-0.5 rounded-full border border-border bg-background/50 py-0.5 pl-0.5 pr-1 shadow-sm sm:pr-1.5"
            >
              <div class="h-8 w-8 rounded-full bg-muted" />
              <div class="ml-0.5 mr-2 hidden h-4 w-16 rounded bg-muted sm:block" />
              <div class="h-4 w-4 rounded bg-muted" />
            </div>
          </template>
        </ClientOnly>
      </div>
    </div>

    <!-- Create Team Dialog -->
    <SettingsCreateTeam v-model:open="isCreateTeamOpen" @created="onTeamCreated" />

    <SettingsSheet />
  </nav>
</template>
