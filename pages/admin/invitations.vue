<script setup lang="ts">
import { toast } from "vue-sonner";
import type { ActionDef } from "~/types/data-table";
import type { AdminPlan } from "~/types";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import DataTable from "~/components/data-table/DataTable.vue";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const { locale, t } = useI18n();

useHead({
  title: () => t("admin.invitations.pageTitle"),
});

const applyBreadcrumb = (): void => {
  setBreadcrumbs([
    { label: t("admin.common.admin"), to: "/admin/overview" },
    { label: t("admin.common.invitations") },
  ]);
};
applyBreadcrumb();
watch(locale, applyBreadcrumb);

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
const invitePlanId = ref("");
const inviteTrialEndsAt = ref("");

// Plans drive the plan selector. Loaded once, lazily, the first time the
// dialog opens.
const plans = ref<AdminPlan[]>([]);
const plansLoading = ref(false);

const loadPlans = async () => {
  if (plans.value.length || plansLoading.value) return;
  plansLoading.value = true;
  try {
    const res = await adminService.plans();
    plans.value = res.data ?? [];
  } catch {
    toast.error(t("admin.invitations.loadPlansFailed"));
  } finally {
    plansLoading.value = false;
  }
};

const formatPrice = (cents: number): string =>
  `${(cents / 100).toLocaleString(locale.value, {
    style: "currency",
    currency: "USD",
  })}${t("admin.invitations.perMonth")}`;

const openInvite = () => {
  inviteEmail.value = "";
  invitePlanId.value = "";
  inviteTrialEndsAt.value = "";
  inviteOpen.value = true;
  loadPlans();
};

const submitInvite = async () => {
  if (!inviteEmail.value.trim()) {
    toast.error(t("admin.invitations.emailRequired"));
    return;
  }
  if (!invitePlanId.value) {
    toast.error(t("admin.invitations.planRequired"));
    return;
  }
  if (!inviteTrialEndsAt.value) {
    toast.error(t("admin.invitations.trialEndRequired"));
    return;
  }
  inviting.value = true;
  try {
    await adminService.createInvitation({
      email: inviteEmail.value.trim(),
      plan_id: invitePlanId.value,
      trial_ends_at: new Date(inviteTrialEndsAt.value).toISOString(),
    });
    toast.success(
      t("admin.invitations.sent", { email: inviteEmail.value.trim() }),
    );
    inviteOpen.value = false;
    table.value?.refresh();
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("admin.invitations.createFailed"));
  } finally {
    inviting.value = false;
  }
};
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex items-center justify-between gap-4">
      <p class="text-sm text-muted-foreground">
        {{ t("admin.invitations.description") }}
      </p>
      <Button v-if="isSuperAdmin" size="sm" @click="openInvite">
        <Icon name="lucide:user-plus" class="h-4 w-4" />
        {{ t("admin.invitations.inviteUser") }}
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
          <DialogTitle>{{ t("admin.invitations.inviteUser") }}</DialogTitle>
          <DialogDescription>
            {{ t("admin.invitations.dialogDescription") }}
          </DialogDescription>
        </DialogHeader>
        <div class="space-y-4 py-2">
          <div class="space-y-2">
            <Label for="invite-email">{{ t("admin.invitations.email") }}</Label>
            <Input
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              placeholder="user@example.com"
            />
          </div>
          <div class="space-y-2">
            <Label for="invite-plan">{{ t("admin.invitations.plan") }}</Label>
            <Select v-model="invitePlanId">
              <SelectTrigger id="invite-plan" class="w-full">
                <SelectValue
                  :placeholder="
                    plansLoading
                      ? t('admin.invitations.loadingPlans')
                      : t('admin.invitations.selectPlan')
                  "
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem
                  v-for="plan in plans"
                  :key="plan.id"
                  :value="plan.id"
                >
                  {{ plan.name }} · {{ formatPrice(plan.monthly_pricing) }}
                </SelectItem>
              </SelectContent>
            </Select>
            <p class="text-xs text-muted-foreground">
              {{ t("admin.invitations.acceptHint") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="invite-trial">
              {{ t("admin.invitations.trialEndDate") }}
            </Label>
            <Input id="invite-trial" v-model="inviteTrialEndsAt" type="date" />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="inviting"
            @click="inviteOpen = false"
          >
            {{ t("admin.common.cancel") }}
          </Button>
          <Button :disabled="inviting" @click="submitInvite">
            <Icon
              v-if="inviting"
              name="lucide:loader-2"
              class="h-4 w-4 animate-spin"
            />
            {{ t("admin.invitations.send") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
