<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { differenceInCalendarDays } from "date-fns";
import { toast } from "vue-sonner";
import type { AdminTeam, AdminUserRow } from "~/types";
import { adminService } from "~/services/adminService";
import { useAuth } from "~/composables/useAuth";
import { useImpersonation } from "~/composables/useImpersonation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "~/components/ui/alert-dialog";

definePageMeta({
  layout: "default",
  middleware: ["auth", "staff"],
});

const route = useRoute();
const userId = route.params.id as string;

const { user: currentUser } = useAuth();
const isSuperAdmin = computed(
  () => currentUser.value?.staff_role === "super_admin",
);
const isSelf = computed(() => String(currentUser.value?.id) === userId);

const { start } = useImpersonation();

const user = ref<AdminUserRow | null>(null);
const isLoading = ref(true);
const notFound = ref(false);
const busy = ref<"suspend" | "unsuspend" | "delete" | "spectate" | null>(null);

useHead({ title: () => `Admin — ${user.value?.name ?? "User"}` });

function applyBreadcrumb(): void {
  setBreadcrumbs([
    { label: "Admin", to: "/admin/overview" },
    { label: "Users", to: "/admin" },
    { label: user.value?.name || "User" },
  ]);
}
applyBreadcrumb();

const isSuspended = computed(() => user.value?.status === "suspended");
const statusVariant = computed(() =>
  isSuspended.value ? "destructive" : "green",
);

const initials = computed(() =>
  (user.value?.name || "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2),
);

const joined = computed(() =>
  user.value?.created_at
    ? new Date(user.value.created_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "—",
);

const activeSubs = computed(
  () =>
    user.value?.teams.filter((t) => t.subscription?.status === "active")
      .length ?? 0,
);

// Subscription → badge mapping (matches the teams chips elsewhere).
function subBadge(team: AdminTeam): {
  variant: "green" | "blue" | "orange" | "secondary";
  label: string;
} {
  const sub = team.subscription;
  if (!sub) return { variant: "secondary", label: "free" };
  switch (sub.status) {
    case "active":
      return { variant: "green", label: "active" };
    case "on_trial": {
      const days = sub.trial_ends_at
        ? differenceInCalendarDays(new Date(sub.trial_ends_at), new Date())
        : null;
      return {
        variant: "blue",
        label: days !== null ? `trial · ${days}d` : "trial",
      };
    }
    case "past_due":
    case "unpaid":
      return { variant: "orange", label: sub.status.replace("_", " ") };
    default:
      return { variant: "secondary", label: sub.status };
  }
}

async function load(): Promise<void> {
  isLoading.value = true;
  try {
    const res = await adminService.showUser(userId);
    user.value = res.data;
    applyBreadcrumb();
  } catch (error: unknown) {
    const err = error as { status?: number; statusCode?: number };
    if (err.status === 404 || err.statusCode === 404) {
      notFound.value = true;
    } else {
      toast.error("Failed to load user");
    }
  } finally {
    isLoading.value = false;
  }
}

function actionError(error: unknown, fallback: string): void {
  const err = error as { data?: { message?: string } };
  toast.error(err.data?.message || fallback);
}

async function suspend(): Promise<void> {
  busy.value = "suspend";
  try {
    await adminService.suspendUser(userId);
    toast.success("User suspended");
    await load();
  } catch (error: unknown) {
    actionError(error, "Failed to suspend user");
  } finally {
    busy.value = null;
  }
}

async function unsuspend(): Promise<void> {
  busy.value = "unsuspend";
  try {
    await adminService.unsuspendUser(userId);
    toast.success("User unsuspended");
    await load();
  } catch (error: unknown) {
    actionError(error, "Failed to unsuspend user");
  } finally {
    busy.value = null;
  }
}

async function remove(): Promise<void> {
  busy.value = "delete";
  try {
    await adminService.deleteUser(userId);
    toast.success("User deleted");
    navigateTo("/admin");
  } catch (error: unknown) {
    actionError(error, "Failed to delete user");
    busy.value = null;
  }
}

async function spectate(): Promise<void> {
  busy.value = "spectate";
  try {
    await start(userId, "Staff support session");
  } catch (error: unknown) {
    actionError(error, "Failed to start spectate session");
    busy.value = null;
  }
}

onMounted(load);
</script>

<template>
  <div class="pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed py-16"
    >
      <Icon name="lucide:user-x" class="h-10 w-10 text-muted-foreground" />
      <p class="text-sm text-muted-foreground">This user no longer exists.</p>
      <Button variant="outline" size="sm" @click="navigateTo('/admin')">
        Back to users
      </Button>
    </div>

    <div v-else-if="user" class="space-y-5">
      <!-- Hero -->
      <div
        class="relative overflow-hidden rounded-xl border bg-gradient-to-br from-card via-card to-muted/40 p-6"
      >
        <div
          class="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-2xl"
        />
        <div class="relative flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-4">
            <Avatar class="h-16 w-16 border shadow-sm">
              <AvatarFallback class="text-lg font-semibold">
                {{ initials }}
              </AvatarFallback>
            </Avatar>
            <div class="space-y-1">
              <div class="flex flex-wrap items-center gap-2">
                <h1 class="text-2xl font-semibold tracking-tight">
                  {{ user.name }}
                </h1>
                <Badge :variant="statusVariant" class="capitalize">
                  {{ user.status }}
                </Badge>
                <Badge v-if="user.staff_role" variant="secondary" class="gap-1">
                  <Icon name="lucide:shield" class="h-3 w-3" />
                  {{ user.staff_role }}
                </Badge>
              </div>
              <p
                class="flex items-center gap-1.5 text-sm text-muted-foreground"
              >
                <Icon name="lucide:mail" class="h-3.5 w-3.5" />
                {{ user.email }}
              </p>
            </div>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              :disabled="busy === 'spectate'"
              @click="spectate"
            >
              <Icon
                :name="busy === 'spectate' ? 'lucide:loader-2' : 'lucide:eye'"
                class="h-4 w-4"
                :class="{ 'animate-spin': busy === 'spectate' }"
              />
              Spectate
            </Button>

            <template v-if="isSuperAdmin && !isSelf">
              <Button
                v-if="!isSuspended"
                variant="outline"
                size="sm"
                :disabled="busy === 'suspend'"
                @click="suspend"
              >
                <Icon
                  :name="busy === 'suspend' ? 'lucide:loader-2' : 'lucide:ban'"
                  class="h-4 w-4"
                  :class="{ 'animate-spin': busy === 'suspend' }"
                />
                Suspend
              </Button>
              <Button
                v-else
                variant="outline"
                size="sm"
                :disabled="busy === 'unsuspend'"
                @click="unsuspend"
              >
                <Icon
                  :name="
                    busy === 'unsuspend'
                      ? 'lucide:loader-2'
                      : 'lucide:circle-check'
                  "
                  class="h-4 w-4"
                  :class="{ 'animate-spin': busy === 'unsuspend' }"
                />
                Unsuspend
              </Button>

              <AlertDialog>
                <AlertDialogTrigger as-child>
                  <Button
                    variant="destructive"
                    size="sm"
                    :disabled="busy === 'delete'"
                  >
                    <Icon name="lucide:trash-2" class="h-4 w-4" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Permanently deletes {{ user.name }} and all their data.
                      Only allowed if they never had a paying subscription.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      @click="remove"
                    >
                      Delete user
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </template>
          </div>
        </div>
      </div>

      <!-- Stat tiles -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:activity" class="h-3.5 w-3.5" />
            Status
          </div>
          <p class="mt-2 text-lg font-semibold capitalize">{{ user.status }}</p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:users" class="h-3.5 w-3.5" />
            Teams
          </div>
          <p class="mt-2 text-lg font-semibold">{{ user.teams.length }}</p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:badge-check" class="h-3.5 w-3.5" />
            Active subs
          </div>
          <p class="mt-2 text-lg font-semibold">{{ activeSubs }}</p>
        </div>
        <div class="rounded-xl border bg-card p-4">
          <div
            class="flex items-center gap-1.5 text-xs font-medium text-muted-foreground"
          >
            <Icon name="lucide:calendar" class="h-3.5 w-3.5" />
            Joined
          </div>
          <p class="mt-2 text-sm font-semibold">{{ joined }}</p>
        </div>
      </div>

      <!-- Teams -->
      <div class="rounded-xl border bg-card">
        <div class="flex items-center gap-2 border-b px-5 py-3">
          <Icon name="lucide:users" class="h-4 w-4 text-muted-foreground" />
          <h2 class="text-sm font-semibold">Teams &amp; subscriptions</h2>
        </div>
        <div v-if="user.teams.length" class="divide-y">
          <div
            v-for="team in user.teams"
            :key="team.id"
            class="flex items-center justify-between gap-4 px-5 py-3"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-lg bg-muted"
              >
                <Icon
                  :name="
                    team.personal_team ? 'lucide:user' : 'lucide:users-round'
                  "
                  class="h-4 w-4 text-muted-foreground"
                />
              </div>
              <div>
                <p class="text-sm font-medium">{{ team.name }}</p>
                <p class="text-xs text-muted-foreground">
                  {{ team.personal_team ? "Personal team" : "Team" }}
                </p>
              </div>
            </div>
            <Badge :variant="subBadge(team).variant">
              {{ subBadge(team).label }}
            </Badge>
          </div>
        </div>
        <p v-else class="px-5 py-8 text-center text-sm text-muted-foreground">
          This user does not own any teams.
        </p>
      </div>
    </div>
  </div>
</template>
