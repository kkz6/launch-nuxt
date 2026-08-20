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
const { t } = useI18n();
const { setCurrentTeamId } = useApi();
const { close: closeSettings } = useSettingsSheet();
const { canManageTeam } = useCan();
const { teams, loadTeams, updateTeam, removeTeam } = useTeams();
const { refreshActiveTeam } = useActiveTeamRefresh();

const members = ref<TeamMember[]>([]);
const invitations = ref<TeamInvitation[]>([]);
const currentTeam = ref<Team | null>(null);
const teamName = ref("");
const transferToTeamId = ref("");
const isLoading = ref(true);
const isInviteOpen = ref(false);
const isDeleteOpen = ref(false);
const isRenaming = ref(false);
const isDeleting = ref(false);
const resendingId = ref<string | null>(null);

const roles = computed(() => [
  {
    value: "owner",
    label: t("settings.teams.roles.owner"),
    description: t("settings.teams.roles.ownerDescription"),
  },
  {
    value: "admin",
    label: t("settings.teams.roles.admin"),
    description: t("settings.teams.roles.adminDescription"),
  },
  {
    value: "editor",
    label: t("settings.teams.roles.editor"),
    description: t("settings.teams.roles.editorDescription"),
  },
  {
    value: "member",
    label: t("settings.teams.roles.member"),
    description: t("settings.teams.roles.memberDescription"),
  },
]);
const assignableRoles = computed(() =>
  roles.value.filter((role) => role.value !== "owner"),
);

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

    const [teamResponse, membersResponse, invitationsResponse] =
      await Promise.all([
        $api<{ data: Team }>(`/teams/${teamId}`),
        $api<{ data: TeamMember[] }>(`/teams/${teamId}/members`),
        $api<{ data: TeamInvitation[] }>(`/teams/${teamId}/invitations`).catch(
          () => ({ data: [] as TeamInvitation[] }),
        ),
        loadTeams(),
      ]);
    currentTeam.value = teamResponse.data;
    teamName.value = teamResponse.data.name;
    members.value = membersResponse.data;
    invitations.value = invitationsResponse.data;
    transferToTeamId.value = transferTeams.value[0]?.id || "";
  } catch {
    toast.error(t("settings.teams.loadFailed"));
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
    updateTeam(response.data);
    await fetchUser();
    toast.success(t("settings.teams.nameUpdated"));
  } catch (error) {
    toast.error(errorMessage(error, t("settings.teams.nameUpdateFailed")));
  } finally {
    isRenaming.value = false;
  }
};

const deleteTeam = async () => {
  if (!currentTeam.value || !transferToTeamId.value) return;
  isDeleting.value = true;
  try {
    const deletedTeamId = currentTeam.value.id;
    const response = await $api<{ data: Team }>(`/teams/${deletedTeamId}`, {
      method: "DELETE",
      body: { transfer_to_team_id: transferToTeamId.value },
    });
    removeTeam(deletedTeamId);
    updateTeam(response.data);
    setCurrentTeamId(response.data.id);
    await fetchUser();
    refreshActiveTeam();
    isDeleteOpen.value = false;
    closeSettings();
    toast.success(t("settings.teams.deleted"));
    await navigateTo("/dashboard");
  } catch (error) {
    toast.error(errorMessage(error, t("settings.teams.deleteFailed")));
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
    toast.success(t("settings.teams.invitationResent"));
  } catch {
    toast.error(t("settings.teams.invitationResendFailed"));
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
    toast.success(t("settings.teams.invitationCancelled"));
  } catch {
    toast.error(t("settings.teams.invitationCancelFailed"));
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
    toast.success(t("settings.teams.roleUpdated"));
  } catch {
    toast.error(t("settings.teams.roleUpdateFailed"));
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

const roleLabel = (role: string) =>
  roles.value.find((item) => item.value === role)?.label || role;

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
        <h3 class="text-base font-semibold">
          {{ t("settings.teams.detailsTitle") }}
        </h3>
        <p class="mt-1 text-sm text-muted-foreground">
          {{ t("settings.teams.detailsDescription") }}
        </p>
        <form class="mt-4 max-w-xl" @submit.prevent="renameTeam">
          <Label for="team-name">{{ t("settings.teams.teamName") }}</Label>
          <div class="mt-2 flex items-center gap-2">
            <Input
              id="team-name"
              v-model="teamName"
              class="flex-1"
              minlength="2"
              maxlength="255"
            />
            <Button type="submit" class="shrink-0" :disabled="!canRename">
              <Icon
                v-if="isRenaming"
                name="lucide:loader-2"
                class="mr-2 h-4 w-4 animate-spin"
              />
              {{ t("settings.teams.save") }}
            </Button>
          </div>
        </form>
      </div>

      <div class="px-6 py-6 first:pt-0">
        <div class="mb-4 flex items-center justify-between">
          <div>
            <h3 class="text-base font-semibold">
              {{ t("settings.teams.membersTitle") }}
            </h3>
            <p class="text-sm text-muted-foreground">
              {{ t("settings.teams.membersDescription") }}
            </p>
          </div>
          <Button
            v-if="canManageTeam"
            variant="outline"
            size="sm"
            @click="isInviteOpen = true"
          >
            <Icon name="lucide:plus" class="mr-1.5 h-4 w-4" />
            {{ t("settings.teams.invite") }}
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
                    {{ t("settings.teams.you") }}
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
        <h3 class="mb-4 text-base font-semibold">
          {{ t("settings.teams.pendingInvitations") }}
        </h3>
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
                    roleLabel(invitation.role)
                  }}</Badge>
                  <span class="text-xs text-muted-foreground">{{
                    t("settings.teams.pending")
                  }}</span>
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
                {{ t("settings.teams.resend") }}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                class="text-destructive hover:text-destructive"
                @click="cancelInvitation(invitation.id)"
              >
                {{ t("settings.teams.cancel") }}
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
            <h3 class="text-sm font-semibold">
              {{ t("settings.teams.deleteTitle") }}
            </h3>
            <p class="mt-1 text-sm text-muted-foreground">
              {{ t("settings.teams.deleteDescription") }}
            </p>
          </div>
          <Button
            variant="destructive"
            :disabled="transferTeams.length === 0"
            @click="isDeleteOpen = true"
          >
            {{ t("settings.teams.deleteTitle") }}
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
          <AlertDialogTitle>{{
            t("settings.teams.deleteDialogTitle", { name: currentTeam?.name })
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t("settings.teams.deleteDialogDescription") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div class="space-y-2 py-2">
          <Label for="transfer-team">{{
            t("settings.teams.transferTo")
          }}</Label>
          <select
            id="transfer-team"
            v-model="transferToTeamId"
            class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <option
              v-for="team in transferTeams"
              :key="team.id"
              :value="team.id"
            >
              {{ team.name
              }}{{
                team.personal_team ? ` ${t("settings.teams.personal")}` : ""
              }}
            </option>
          </select>
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">{{
            t("settings.teams.cancel")
          }}</AlertDialogCancel>
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
            {{ t("settings.teams.transferAndDelete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
