<script setup lang="ts">
import { differenceInCalendarDays, formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { AdminUserRow, AdminTeam, PlatformInvitation } from "~/types";
import type { BadgeVariants } from "~/components/ui/badge";
import { adminService } from "~/services/adminService";
import { useImpersonation } from "~/composables/useImpersonation";
import { useAuth } from "~/composables/useAuth";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Users",
});

const PER_PAGE = 20;

const { user } = useAuth();
const isSuperAdmin = computed(() => user.value?.staff_role === "super_admin");

const users = ref<AdminUserRow[]>([]);
const isLoading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);
const spectatingId = ref<string | number | null>(null);
const togglingId = ref<string | number | null>(null);

const { start } = useImpersonation();

const fetchUsers = async (page = 1) => {
  isLoading.value = true;
  try {
    const response = await adminService.users({
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    });
    users.value = response.data;
    total.value = response.meta?.total ?? response.data.length;
    lastPage.value = response.meta?.last_page ?? 1;
    currentPage.value = response.meta?.current_page ?? page;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load users");
  } finally {
    isLoading.value = false;
  }
};

const goToPage = (page: number) => {
  if (page < 1 || page > lastPage.value) return;
  fetchUsers(page);
};

const spectate = async (target: AdminUserRow) => {
  spectatingId.value = target.id;
  try {
    await start(target.id, "Staff support session");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to start spectate session");
    spectatingId.value = null;
  }
};

const staffBadgeVariant = (role?: string | null): BadgeVariants["variant"] => {
  if (role === "super_admin") return "destructive";
  if (role === "support") return "blue";
  return "secondary";
};

// Subscription chip mapping
interface SubBadge {
  variant: BadgeVariants["variant"];
  label: string;
}

const subscriptionBadge = (team: AdminTeam): SubBadge | null => {
  const sub = team.subscription;
  if (!sub || !sub.status) {
    return { variant: "blank", label: "free" };
  }

  switch (sub.status) {
    case "active":
      return { variant: "green", label: "active" };
    case "on_trial": {
      let label = "trial";
      if (sub.trial_ends_at) {
        const days = differenceInCalendarDays(
          new Date(sub.trial_ends_at),
          new Date(),
        );
        if (days >= 0) {
          label = `trial · ${days}d left`;
        }
      }
      return { variant: "blue", label };
    }
    case "past_due":
    case "unpaid":
      return { variant: "orange", label: sub.status.replace("_", " ") };
    case "cancelled":
    case "canceled":
    case "expired":
      return { variant: "blank", label: sub.status };
    default:
      return { variant: "secondary", label: sub.status };
  }
};

const isSuspended = (u: AdminUserRow) => u.status === "suspended";

const toggleSuspend = async (u: AdminUserRow) => {
  togglingId.value = u.id;
  const suspended = isSuspended(u);
  try {
    if (suspended) {
      await adminService.unsuspendUser(u.id);
      u.status = "active";
      toast.success(`${u.name} reactivated`);
    } else {
      await adminService.suspendUser(u.id);
      u.status = "suspended";
      toast.success(`${u.name} suspended`);
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to update user status");
  } finally {
    togglingId.value = null;
  }
};

// Delete user
const deleteTarget = ref<AdminUserRow | null>(null);
const deleteOpen = ref(false);
const deleting = ref(false);

const confirmDelete = (u: AdminUserRow) => {
  deleteTarget.value = u;
  deleteOpen.value = true;
};

const performDelete = async () => {
  if (!deleteTarget.value) return;
  const target = deleteTarget.value;
  deleting.value = true;
  try {
    await adminService.deleteUser(target.id);
    users.value = users.value.filter((u) => u.id !== target.id);
    toast.success(`${target.name} deleted`);
    deleteOpen.value = false;
    deleteTarget.value = null;
  } catch (error: unknown) {
    const err = error as {
      statusCode?: number;
      status?: number;
      data?: { message?: string };
    };
    const status = err.statusCode ?? err.status;
    if (status === 409) {
      toast.error(err.data?.message || "User cannot be deleted");
    } else {
      toast.error(err.data?.message || "Failed to delete user");
    }
  } finally {
    deleting.value = false;
  }
};

// Invitations
const invitations = ref<PlatformInvitation[]>([]);
const inviteOpen = ref(false);
const inviting = ref(false);
const inviteEmail = ref("");
const inviteTrialEndsAt = ref("");

const fetchInvitations = async () => {
  if (!isSuperAdmin.value) return;
  try {
    const response = await adminService.invitations();
    invitations.value = response.data;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load invitations");
  }
};

const openInvite = () => {
  inviteEmail.value = "";
  inviteTrialEndsAt.value = "";
  inviteOpen.value = true;
};

const submitInvite = async () => {
  if (!inviteEmail.value.trim()) {
    toast.error("Email is required");
    return;
  }
  if (!inviteTrialEndsAt.value) {
    toast.error("Trial end date is required");
    return;
  }
  inviting.value = true;
  try {
    await adminService.createInvitation({
      email: inviteEmail.value.trim(),
      trial_ends_at: new Date(inviteTrialEndsAt.value).toISOString(),
    });
    toast.success(`Invitation sent to ${inviteEmail.value.trim()}`);
    inviteOpen.value = false;
    await fetchInvitations();
  } catch (error: unknown) {
    const err = error as {
      statusCode?: number;
      status?: number;
      data?: { message?: string };
    };
    toast.error(err.data?.message || "Failed to create invitation");
  } finally {
    inviting.value = false;
  }
};

const revokingId = ref<string | number | null>(null);

const revokeInvite = async (invite: PlatformInvitation) => {
  revokingId.value = invite.id;
  try {
    await adminService.revokeInvitation(invite.id);
    invitations.value = invitations.value.filter((i) => i.id !== invite.id);
    toast.success(`Invitation for ${invite.email} revoked`);
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to revoke invitation");
  } finally {
    revokingId.value = null;
  }
};

const formatDate = (date?: string | null): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(() => {
  fetchUsers();
  fetchInvitations();
});
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <div class="flex items-center justify-between gap-4">
      <p class="text-sm text-muted-foreground">
        Browse users and spectate (read-only) as any user for support.
      </p>
      <Button v-if="isSuperAdmin" size="sm" @click="openInvite">
        <Icon name="lucide:user-plus" class="h-4 w-4" />
        Invite user
      </Button>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Teams</TableHead>
            <TableHead>Staff Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="u in users" :key="u.id">
            <TableCell class="font-medium">{{ u.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ u.email }}</TableCell>
            <TableCell>
              <div class="flex max-w-xs flex-wrap gap-1.5">
                <span
                  v-for="team in u.teams"
                  :key="team.id"
                  class="inline-flex items-center gap-1 rounded-md border bg-muted/40 px-1.5 py-0.5 text-xs"
                >
                  <span class="font-medium">{{ team.name }}</span>
                  <Badge
                    v-if="subscriptionBadge(team)"
                    :variant="subscriptionBadge(team)!.variant"
                  >
                    {{ subscriptionBadge(team)!.label }}
                  </Badge>
                </span>
                <span
                  v-if="u.teams.length === 0"
                  class="text-xs text-muted-foreground"
                >
                  —
                </span>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                v-if="u.staff_role"
                :variant="staffBadgeVariant(u.staff_role)"
              >
                {{ u.staff_role }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell>
              <Badge v-if="isSuspended(u)" variant="red">Suspended</Badge>
              <span v-else class="text-xs text-muted-foreground">Active</span>
            </TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground">
              {{ formatDate(u.created_at) }}
            </TableCell>
            <TableCell>
              <div class="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="spectatingId === u.id"
                  @click="spectate(u)"
                >
                  <Icon
                    v-if="spectatingId === u.id"
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin"
                  />
                  <Icon v-else name="lucide:eye" class="h-4 w-4" />
                  Spectate
                </Button>

                <template v-if="isSuperAdmin">
                  <Button
                    :variant="isSuspended(u) ? 'outline' : 'secondary'"
                    size="sm"
                    :disabled="togglingId === u.id"
                    @click="toggleSuspend(u)"
                  >
                    <Icon
                      v-if="togglingId === u.id"
                      name="lucide:loader-2"
                      class="h-4 w-4 animate-spin"
                    />
                    <Icon
                      v-else
                      :name="
                        isSuspended(u) ? 'lucide:circle-check' : 'lucide:ban'
                      "
                      class="h-4 w-4"
                    />
                    {{ isSuspended(u) ? "Unsuspend" : "Suspend" }}
                  </Button>

                  <Button
                    v-if="!u.staff_role"
                    variant="destructive"
                    size="sm"
                    @click="confirmDelete(u)"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                    Delete
                  </Button>
                </template>
              </div>
            </TableCell>
          </TableRow>

          <TableRow v-if="users.length === 0">
            <TableCell
              colspan="7"
              class="py-10 text-center text-muted-foreground"
            >
              No users found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="lastPage > 1"
        class="flex items-center justify-between text-sm text-muted-foreground"
      >
        <span>{{ total }} users</span>
        <div class="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage <= 1"
            @click="goToPage(currentPage - 1)"
          >
            Previous
          </Button>
          <span>Page {{ currentPage }} of {{ lastPage }}</span>
          <Button
            variant="outline"
            size="sm"
            :disabled="currentPage >= lastPage"
            @click="goToPage(currentPage + 1)"
          >
            Next
          </Button>
        </div>
      </div>

      <!-- Pending invitations -->
      <div v-if="isSuperAdmin" class="space-y-3 pt-4">
        <h2 class="text-sm font-semibold">Pending invitations</h2>
        <Table v-if="invitations.length">
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Trial ends</TableHead>
              <TableHead>Expires</TableHead>
              <TableHead class="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="invite in invitations" :key="invite.id">
              <TableCell class="font-medium">{{ invite.email }}</TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(invite.trial_ends_at) }}
              </TableCell>
              <TableCell class="text-muted-foreground">
                {{ formatDate(invite.expires_at) }}
              </TableCell>
              <TableCell class="text-right">
                <Button
                  variant="outline"
                  size="sm"
                  :disabled="revokingId === invite.id"
                  @click="revokeInvite(invite)"
                >
                  <Icon
                    v-if="revokingId === invite.id"
                    name="lucide:loader-2"
                    class="h-4 w-4 animate-spin"
                  />
                  <Icon v-else name="lucide:x" class="h-4 w-4" />
                  Revoke
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
        <p v-else class="text-sm text-muted-foreground">
          No pending invitations.
        </p>
      </div>
    </template>

    <!-- Delete confirmation dialog -->
    <Dialog v-model:open="deleteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Delete user</DialogTitle>
          <DialogDescription>
            Permanently delete {{ deleteTarget?.name }} and all their data? This
            cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="deleting"
            @click="deleteOpen = false"
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            :disabled="deleting"
            @click="performDelete"
          >
            <Icon
              v-if="deleting"
              name="lucide:loader-2"
              class="h-4 w-4 animate-spin"
            />
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Invite user dialog -->
    <Dialog v-model:open="inviteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Send a platform invitation with a trial period.
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label for="invite-email">Email</Label>
            <Input
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              placeholder="user@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="invite-trial">Trial end date</Label>
            <Input id="invite-trial" v-model="inviteTrialEndsAt" type="date" />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="inviting"
            @click="inviteOpen = false"
          >
            Cancel
          </Button>
          <Button :disabled="inviting" @click="submitInvite">
            <Icon
              v-if="inviting"
              name="lucide:loader-2"
              class="h-4 w-4 animate-spin"
            />
            Send invitation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
