<script setup lang="ts">
import { toast } from "vue-sonner";
import { Avatar, AvatarFallback, AvatarImage } from "~/components/ui/avatar";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Team } from "~/types";

interface TeamMember {
  id: string;
  name: string;
  email: string;
  profile_photo_url?: string;
  role: string;
}

interface TeamInvitation {
  id: string;
  email: string;
  role: string;
  created_at: string;
}

const { user, fetchUser } = useAuth();
const { setCurrentTeamId } = useApi();
const { close: closeSettings } = useSettingsSheet();
const { canManageTeam } = useCan();
const teamsRefreshKey = useState("teamsRefreshKey", () => 0);

const members = ref<TeamMember[]>([]);
const invitations = ref<TeamInvitation[]>([]);
const teams = ref<Team[]>([]);
const currentTeam = ref<Team | null>(null);
const teamName = ref("");
const transferToTeamId = ref("");
const isLoading = ref(true);
const isInviteOpen = ref(false);
const isDeleteOpen = ref(false);
const isRenaming = ref(false);
const isDeleting = ref(false);
const resendingId = ref<string | null>(null);

const roles = [
  { value: "owner", label: "Owner", description: "Full access to the team." },
  {
    value: "admin",
    label: "Admin",
    description: "Can manage members, settings, and team resources.",
  },
  {
    value: "editor",
    label: "Editor",
    description: "Can create and update team resources.",
  },
  {
    value: "member",
    label: "Member",
    description: "Can view team resources.",
  },
];
const assignableRoles = roles.filter((role) => role.value !== "owner");

const isOwner = computed(
  () => currentTeam.value?.user_id === String(user.value?.id),
);
const transferTeams = computed(() =>
  teams.value.filter(
    (team) =>
      team.id !== currentTeam.value?.id &&
      (team.is_owner || team.user_id === String(user.value?.id)),
  ),
);
const canRename = computed(
  () =>
    isOwner.value &&
    teamName.value.trim().length >= 2 &&
    teamName.value.trim() !== currentTeam.value?.name &&
    !isRenaming.value,
);

const errorMessage = (error: unknown, fallback: string) => {
  if (error && typeof error === "object" && "data" in error) {
    return (error as { data?: { message?: string } }).data?.message || fallback;
  }
  return fallback;
};

const fetchTeamMembers = async () => {
  try {
    const teamId = user.value?.current_team_id;
    if (!teamId) return;

    const [teamResponse, membersResponse, invitationsResponse, teamsResponse] =
      await Promise.all([
        $api<{ data: Team }>(`/teams/${teamId}`),
        $api<{ data: TeamMember[] }>(`/teams/${teamId}/members`),
        $api<{ data: TeamInvitation[] }>(`/teams/${teamId}/invitations`).catch(
          () => ({ data: [] as TeamInvitation[] }),
        ),
        $api<{ data: Team[] }>("/teams"),
      ]);
    currentTeam.value = teamResponse.data;
    teamName.value = teamResponse.data.name;
    members.value = membersResponse.data;
    invitations.value = invitationsResponse.data;
    teams.value = teamsResponse.data;
    transferToTeamId.value = transferTeams.value[0]?.id || "";
  } catch {
    toast.error("Failed to load team settings");
  } finally {
    isLoading.value = false;
  }
};

const renameTeam = async () => {
  if (!currentTeam.value || !canRename.value) return;
  isRenaming.value = true;
  try {
    const name = teamName.value.trim();
    const response = await $api<{ data: Team }>(
      `/teams/${currentTeam.value.id}`,
      {
        method: "PUT",
        body: { name },
      },
    );
    currentTeam.value = response.data;
    teamName.value = response.data.name;
    const listedTeam = teams.value.find((team) => team.id === response.data.id);
    if (listedTeam) listedTeam.name = response.data.name;
    await fetchUser();
    teamsRefreshKey.value++;
    toast.success("Team name updated");
  } catch (error) {
    toast.error(errorMessage(error, "Failed to update team name"));
  } finally {
    isRenaming.value = false;
  }
};

const deleteTeam = async () => {
  if (!currentTeam.value || !transferToTeamId.value) return;
  isDeleting.value = true;
  try {
    await $api(`/teams/${currentTeam.value.id}`, {
      method: "DELETE",
      body: { transfer_to_team_id: transferToTeamId.value },
    });
    setCurrentTeamId(transferToTeamId.value);
    await fetchUser();
    teamsRefreshKey.value++;
    isDeleteOpen.value = false;
    closeSettings();
    toast.success("Team deleted and resources transferred");
    await navigateTo("/dashboard");
  } catch (error) {
    toast.error(errorMessage(error, "Failed to delete team"));
  } finally {
    isDeleting.value = false;
  }
};

const resendInvitation = async (invitationId: string) => {
  resendingId.value = invitationId;
  try {
    await $api(
      `/teams/${currentTeam.value?.id}/invitations/${invitationId}/resend`,
      {
        method: "POST",
      },
    );
    toast.success("Invitation resent");
  } catch {
    toast.error("Failed to resend invitation");
  } finally {
    resendingId.value = null;
  }
};

const cancelInvitation = async (invitationId: string) => {
  try {
    await $api(`/teams/${currentTeam.value?.id}/invitations/${invitationId}`, {
      method: "DELETE",
    });
    invitations.value = invitations.value.filter(
      (invitation) => invitation.id !== invitationId,
    );
    toast.success("Invitation cancelled");
  } catch {
    toast.error("Failed to cancel invitation");
  }
};

const updateMemberRole = async (memberId: string, role: string) => {
  try {
    await $api(`/teams/${currentTeam.value?.id}/members/${memberId}`, {
      method: "PUT",
      body: { role },
    });
    const member = members.value.find((item) => item.id === memberId);
    if (member) member.role = role;
    toast.success("Role updated");
  } catch {
    toast.error("Failed to update role");
  }
};

const getMemberInitials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

const isCurrentUser = (memberId: string) => memberId === String(user.value?.id);

onMounted(fetchTeamMembers);
</script>

<template>
  <div class="divide-y">
    <div v-if="isLoading" class="flex items-center justify-center px-6 py-12">
      <Icon
        name="lucide:loader-2"
        class="h-6 w-6 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <div v-if="isOwner" class="px-6 pb-6">
        <h3 class="text-base font-semibold">Team details</h3>
        <p class="mt-1 text-sm text-muted-foreground">
          Change the name shown to everyone in this team.
        </p>
        <form
          class="mt-4 flex max-w-xl items-end gap-2"
          @submit.prevent="renameTeam"
        >
          <div class="flex-1 space-y-2">
            <Label for="team-name">Team name</Label>
            <Input
              id="team-name"
              v-model="teamName"
              minlength="2"
              maxlength="255"
            />
          </div>
          <Button type="submit" :disabled="!canRename">
            <Icon
              v-if="isRenaming"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Save
          </Button>
        </form>
      </div>

      <div class="px-6 py-6 first:pt-0">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold">Team members</h3>
            <p class="text-sm text-muted-foreground">
              Manage who has access to this team.
            </p>
          </div>
          <Button
            v-if="canManageTeam"
            variant="outline"
            size="sm"
            @click="isInviteOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            Invite
          </Button>
        </div>

        <div class="space-y-1">
          <div
            v-for="member in members"
            :key="member.id"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex items-center gap-3">
              <Avatar class="h-8 w-8">
                <AvatarImage
                  v-if="member.profile_photo_url"
                  :src="member.profile_photo_url"
                />
                <AvatarFallback class="text-xs">{{
                  getMemberInitials(member.name)
                }}</AvatarFallback>
              </Avatar>
              <div>
                <div class="flex items-center gap-1.5">
                  <span class="text-sm font-medium">{{ member.name }}</span>
                  <span
                    v-if="isCurrentUser(member.id)"
                    class="text-xs text-muted-foreground"
                  >
                    (you)
                  </span>
                </div>
                <span class="text-xs text-muted-foreground">{{
                  member.email
                }}</span>
              </div>
            </div>

            <Select
              :model-value="member.role"
              :disabled="!isOwner || member.role === 'owner'"
              @update:model-value="
                (value) => updateMemberRole(member.id, value as string)
              "
            >
              <SelectTrigger class="w-28 text-sm"
                ><SelectValue
              /></SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="role in assignableRoles"
                  :key="role.value"
                  :value="role.value"
                >
                  {{ role.label }}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <div v-if="invitations.length > 0" class="px-6 py-6">
        <h3 class="mb-4 text-base font-semibold">Pending invitations</h3>
        <div class="space-y-1">
          <div
            v-for="invitation in invitations"
            :key="invitation.id"
            class="flex items-center justify-between rounded-lg border p-3"
          >
            <div class="flex items-center gap-3">
              <Avatar class="h-8 w-8">
                <AvatarFallback class="text-xs">
                  {{ invitation.email[0].toUpperCase() }}
                </AvatarFallback>
              </Avatar>
              <div>
                <span class="text-sm font-medium">{{ invitation.email }}</span>
                <div class="flex items-center gap-1.5">
                  <Badge variant="secondary" class="text-xs capitalize">{{
                    invitation.role
                  }}</Badge>
                  <span class="text-xs text-muted-foreground">Pending</span>
                </div>
              </div>
            </div>
            <div v-if="canManageTeam" class="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                :disabled="resendingId === invitation.id"
                @click="resendInvitation(invitation.id)"
              >
                <Icon
                  :name="
                    resendingId === invitation.id
                      ? 'lucide:loader-2'
                      : 'lucide:send'
                  "
                  class="mr-1 h-3.5 w-3.5"
                  :class="{ 'animate-spin': resendingId === invitation.id }"
                />
                Resend
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive"
                @click="cancelInvitation(invitation.id)"
              >
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div class="px-6 py-6">
        <div class="space-y-4">
          <div
            v-for="role in roles"
            :key="role.value"
            class="grid grid-cols-[120px_1fr] gap-4 text-sm"
          >
            <span class="font-medium">{{ role.label }}</span>
            <span class="text-muted-foreground">{{ role.description }}</span>
          </div>
        </div>
      </div>

      <div v-if="isOwner && !currentTeam?.personal_team" class="px-6 pt-6">
        <div
          class="flex items-start justify-between gap-4 rounded-lg border border-destructive/30 p-4"
        >
          <div>
            <h3 class="text-sm font-semibold">Delete team</h3>
            <p class="mt-1 text-sm text-muted-foreground">
              Transfer all resources to another team you own, then permanently
              delete this team.
            </p>
          </div>
          <Button
            variant="destructive"
            :disabled="transferTeams.length === 0"
            @click="isDeleteOpen = true"
          >
            Delete team
          </Button>
        </div>
      </div>
    </template>

    <SettingsInviteMember
      v-model:open="isInviteOpen"
      :team-id="currentTeam?.id"
      @invited="fetchTeamMembers"
    />

    <AlertDialog v-model:open="isDeleteOpen">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete {{ currentTeam?.name }}?</AlertDialogTitle>
          <AlertDialogDescription>
            Choose where every server, site, database, backup, provider, and
            related resource should move.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="space-y-2 py-2">
          <Label for="transfer-team">Transfer resources to</Label>
          <Select v-model="transferToTeamId">
            <SelectTrigger id="transfer-team"
              ><SelectValue placeholder="Select a team"
            /></SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="team in transferTeams"
                :key="team.id"
                :value="team.id"
              >
                {{ team.name }}{{ team.personal_team ? " (Personal)" : "" }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">Cancel</AlertDialogCancel>
          <AlertDialogAction
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            :disabled="!transferToTeamId || isDeleting"
            @click.prevent="deleteTeam"
          >
            <Icon
              v-if="isDeleting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Transfer and delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
