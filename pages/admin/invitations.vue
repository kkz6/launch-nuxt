<script setup lang="ts">
import { toast } from "vue-sonner";
import type { ActionDef } from "~/types/data-table";
import { adminService } from "~/services/adminService";
import { useAuth } from "~/composables/useAuth";
import { Button } from "~/components/ui/button";
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
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

useHead({
  title: "Admin — Invitations",
});

setBreadcrumbs([
  { label: "Admin", to: "/admin/overview" },
  { label: "Invitations" },
]);

const { user } = useAuth();
const isSuperAdmin = computed(() => user.value?.staff_role === "super_admin");

const table = ref<{ refresh: () => void } | null>(null);

// Revoke is gated at super_admin on the backend; hide it in the UI for
// non-super-admins.
const filterServerActions = (actions: ActionDef[]): ActionDef[] =>
  isSuperAdmin.value ? actions : [];

const inviteOpen = ref(false);
const inviting = ref(false);
const inviteEmail = ref("");
const inviteTrialEndsAt = ref("");

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
    table.value?.refresh();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to create invitation");
  } finally {
    inviting.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm text-muted-foreground">Pending platform invitations.</p>
      <Button v-if="isSuperAdmin" size="sm" @click="openInvite">
        <Icon name="lucide:user-plus" class="h-4 w-4" />
        Invite user
      </Button>
    </div>

    <DataTable
      ref="table"
      endpoint="/admin/invitations/table"
      :row-actions-filter="filterServerActions"
    />

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
