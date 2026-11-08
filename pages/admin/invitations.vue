<script setup lang="ts">
import { toast } from "vue-sonner";
import { shallowRef } from "vue";
import type { DateValue } from "reka-ui";
import type { ActionDef } from "~/types/data-table";
import type { AdminPlan } from "~/types";
import { adminService } from "~/services/adminService";
import { useAuth } from "~/composables/useAuth";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Calendar } from "~/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
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
const trialDate = shallowRef<DateValue>();
const trialDateOpen = ref(false);
const calendarDay = (date: DateValue): string =>
  `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
const inviteTrialEndsAt = computed(() =>
  trialDate.value ? calendarDay(trialDate.value) : "",
);
const trialDateLabel = computed(() =>
  inviteTrialEndsAt.value
    ? new Intl.DateTimeFormat(locale.value, {
        dateStyle: "long",
        timeZone: "UTC",
      }).format(new Date(`${inviteTrialEndsAt.value}T00:00:00.000Z`))
    : t("adminDirectory.invitations.selectDate"),
);
const isTrialDateDisabled = (date: DateValue): boolean =>
  new Date(`${calendarDay(date)}T00:00:00.000Z`).getTime() <= Date.now();
const selectTrialDate = (date: DateValue | undefined): void => {
  if (!date || isTrialDateDisabled(date)) return;
  trialDate.value = date;
  trialDateOpen.value = false;
};
const inviteError = ref("");

// Plans drive the plan selector. Loaded once, lazily, the first time the
// dialog opens.
const plans = ref<AdminPlan[]>([]);
const plansLoading = ref(false);
const plansError = ref(false);

const loadPlans = async () => {
  if (plans.value.length || plansLoading.value) return;
  plansLoading.value = true;
  plansError.value = false;
  try {
    const res = await adminService.plans();
    plans.value = res.data ?? [];
  } catch {
    plansError.value = true;
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
  if (!isSuperAdmin.value || inviting.value) return;
  inviteEmail.value = "";
  invitePlanId.value = "";
  trialDate.value = undefined;
  trialDateOpen.value = false;
  inviteError.value = "";
  inviteOpen.value = true;
  void loadPlans();
};

const submitInvite = async () => {
  if (
    !isSuperAdmin.value ||
    inviting.value ||
    plansLoading.value ||
    plansError.value
  )
    return;
  inviteError.value = "";
  if (!inviteEmail.value.trim()) {
    inviteError.value = t("admin.invitations.emailRequired");
    return;
  }
  if (!invitePlanId.value) {
    inviteError.value = t("admin.invitations.planRequired");
    return;
  }
  if (
    !inviteTrialEndsAt.value ||
    Number.isNaN(new Date(inviteTrialEndsAt.value).getTime())
  ) {
    inviteError.value = t("admin.invitations.trialEndRequired");
    return;
  }
  if (
    new Date(`${inviteTrialEndsAt.value}T00:00:00.000Z`).getTime() <= Date.now()
  ) {
    inviteError.value = t("adminDirectory.invitations.futureDateRequired");
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
    inviteError.value =
      err.data?.message || t("admin.invitations.createFailed");
  } finally {
    inviting.value = false;
  }
};
</script>

<template>
  <div class="space-y-7">
    <AdminPageHeader
      :title="t('admin.common.invitations')"
      :description="t('adminDirectory.invitations.description')"
    >
      <template #actions>
        <Button variant="ghost" size="sm" @click="table?.refresh()">
          <Icon name="lucide:refresh-cw" class="h-3.5 w-3.5" />
          {{ t("adminDirectory.refresh") }}
        </Button>
        <Button v-if="isSuperAdmin" size="sm" @click="openInvite">
          <Icon name="lucide:plus" class="h-4 w-4" />
          {{ t("admin.invitations.inviteUser") }}
        </Button>
      </template>
    </AdminPageHeader>

    <section aria-labelledby="invitations-directory-title" class="space-y-4">
      <div class="sr-only">
        <h2 id="invitations-directory-title" class="font-semibold">
          {{ t("adminDirectory.invitations.directoryTitle") }}
        </h2>
        <p class="text-sm text-muted-foreground">
          {{ t("adminDirectory.invitations.directoryDescription") }}
        </p>
      </div>
      <div class="admin-directory">
        <DataTable
          ref="table"
          borderless
          endpoint="/admin/invitations/table"
          :row-actions-filter="filterServerActions"
        />
      </div>
    </section>

    <!-- Invite user dialog -->
    <Dialog v-model:open="inviteOpen">
      <DialogContent class="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{{ t("admin.invitations.inviteUser") }}</DialogTitle>
          <DialogDescription>
            {{ t("admin.invitations.dialogDescription") }}
          </DialogDescription>
        </DialogHeader>
        <form
          id="admin-invitation-form"
          class="space-y-5 py-2"
          @submit.prevent="submitInvite"
        >
          <div class="space-y-2">
            <Label for="invite-email">{{ t("admin.invitations.email") }}</Label>
            <Input
              id="invite-email"
              v-model="inviteEmail"
              type="email"
              placeholder="user@example.com"
              autocomplete="email"
              required
              :disabled="inviting"
            />
          </div>
          <div class="space-y-2">
            <Label for="invite-plan">{{ t("admin.invitations.plan") }}</Label>
            <Select
              v-model="invitePlanId"
              :disabled="
                inviting || plansLoading || plansError || !plans.length
              "
            >
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
            <p
              v-if="plansLoading"
              role="status"
              class="text-sm text-muted-foreground"
            >
              {{ t("admin.invitations.loadingPlans") }}
            </p>
            <div
              v-else-if="plansError"
              role="alert"
              class="flex items-center justify-between gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm"
            >
              <p>{{ t("admin.invitations.loadPlansFailed") }}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                @click="loadPlans"
                >{{ t("adminDirectory.retry") }}</Button
              >
            </div>
            <p
              v-else-if="!plans.length"
              role="status"
              class="text-sm text-muted-foreground"
            >
              {{ t("adminDirectory.invitations.noPlans") }}
            </p>
            <p class="text-xs text-muted-foreground">
              {{ t("admin.invitations.acceptHint") }}
            </p>
          </div>
          <div class="space-y-2">
            <Label for="invite-trial">
              {{ t("admin.invitations.trialEndDate") }}
            </Label>
            <Popover v-model:open="trialDateOpen">
              <PopoverTrigger as-child>
                <Button
                  id="invite-trial"
                  type="button"
                  variant="outline"
                  class="w-full justify-start text-left font-normal"
                  :class="{ 'text-muted-foreground': !trialDate }"
                  :disabled="inviting"
                  aria-describedby="invite-trial-hint"
                >
                  <Icon name="lucide:calendar-days" class="h-4 w-4" />
                  {{ trialDateLabel }}
                </Button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                class="w-auto max-w-[calc(100vw-2rem)] p-0"
                :collision-padding="16"
              >
                <Calendar
                  :model-value="trialDate"
                  :locale="locale"
                  :is-date-disabled="isTrialDateDisabled"
                  :disabled="inviting"
                  :calendar-label="t('admin.invitations.trialEndDate')"
                  initial-focus
                  prevent-deselect
                  @update:model-value="selectTrialDate"
                />
              </PopoverContent>
            </Popover>
            <p id="invite-trial-hint" class="text-xs text-muted-foreground">
              {{ t("adminDirectory.invitations.dateHint") }}
            </p>
          </div>
          <p
            v-if="inviteError"
            role="alert"
            class="rounded-md border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive"
          >
            {{ inviteError }}
          </p>
        </form>
        <DialogFooter>
          <Button
            variant="outline"
            :disabled="inviting"
            @click="inviteOpen = false"
          >
            {{ t("admin.common.cancel") }}
          </Button>
          <Button
            type="submit"
            form="admin-invitation-form"
            :disabled="inviting || plansLoading || plansError || !plans.length"
          >
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
