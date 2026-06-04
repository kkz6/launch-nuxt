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

    <div v-else-if="user" class="flex flex-col gap-8 lg:flex-row">
      <!-- Left rail: identity, key facts, actions -->
      <aside
        class="shrink-0 space-y-5 lg:sticky lg:top-4 lg:w-72 lg:self-start lg:border-r lg:pr-8"
      >
        <div class="space-y-3">
          <Avatar class="h-16 w-16">
            <AvatarFallback class="text-lg font-semibold">
              {{ initials }}
            </AvatarFallback>
          </Avatar>
          <div class="space-y-1.5">
            <h1 class="text-xl font-semibold tracking-tight">
              {{ user.name }}
            </h1>
            <div class="flex flex-wrap items-center gap-2">
              <Badge :variant="statusVariant" class="capitalize">
                {{ user.status }}
              </Badge>
              <span
                v-if="user.staff_role"
                class="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground"
              >
                <Icon name="lucide:shield" class="h-3.5 w-3.5" />
                {{ user.staff_role }}
              </span>
            </div>
            <p class="break-all text-sm text-muted-foreground">
              {{ user.email }}
            </p>
          </div>
        </div>

        <dl class="space-y-2.5 border-t pt-4 text-sm">
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Teams</dt>
            <dd class="font-medium">{{ user.teams.length }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Active subs</dt>
            <dd class="font-medium">{{ activeSubs }}</dd>
          </div>
          <div class="flex items-center justify-between gap-3">
            <dt class="text-muted-foreground">Joined</dt>
            <dd class="font-medium">{{ joined }}</dd>
          </div>
        </dl>

        <div class="flex flex-col gap-1.5 border-t pt-4">
          <Button
            variant="outline"
            size="sm"
            class="justify-start"
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
              class="justify-start"
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
              class="justify-start"
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
                  variant="ghost"
                  size="sm"
                  class="justify-start text-destructive hover:bg-destructive/10 hover:text-destructive"
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
                    Permanently deletes {{ user.name }} and all their data. Only
                    allowed if they never had a paying subscription.
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
      </aside>

      <!-- Right content -->
      <div class="min-w-0 flex-1">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold">Teams &amp; subscriptions</h2>
          <span class="text-xs text-muted-foreground">
            {{ user.teams.length }}
            {{ user.teams.length === 1 ? "team" : "teams" }}
          </span>
        </div>

        <div v-if="user.teams.length" class="mt-2 divide-y border-t">
          <div
            v-for="team in user.teams"
            :key="team.id"
            class="flex items-center justify-between gap-4 py-3.5"
          >
            <div class="flex items-center gap-3">
              <div
                class="flex h-9 w-9 items-center justify-center rounded-full bg-muted"
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
        <div
          v-else
          class="mt-2 flex flex-col items-center justify-center gap-2 border-t py-16 text-center"
        >
          <Icon name="lucide:users" class="h-8 w-8 text-muted-foreground/50" />
          <p class="text-sm text-muted-foreground">
            This user does not own any teams.
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
