<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { toast } from "vue-sonner";
import type { AdminUserRow } from "~/types";
import { adminService } from "~/services/adminService";
import { useAuth } from "~/composables/useAuth";
import { useImpersonation } from "~/composables/useImpersonation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { TeamsCell } from "~/components/data-table/columns";
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
  <div class="space-y-6 pb-10">
    <div v-if="isLoading" class="flex items-center justify-center py-16">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <div
      v-else-if="notFound"
      class="rounded-lg border border-dashed py-16 text-center"
    >
      <p class="text-sm text-muted-foreground">This user no longer exists.</p>
      <Button
        variant="outline"
        size="sm"
        class="mt-4"
        @click="navigateTo('/admin')"
      >
        Back to users
      </Button>
    </div>

    <template v-else-if="user">
      <!-- Header: identity + actions -->
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="space-y-1">
          <div class="flex items-center gap-3">
            <h1 class="text-2xl font-semibold">{{ user.name }}</h1>
            <Badge :variant="statusVariant">{{ user.status }}</Badge>
            <Badge v-if="user.staff_role" variant="secondary">
              {{ user.staff_role }}
            </Badge>
          </div>
          <p class="text-sm text-muted-foreground">{{ user.email }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <!-- Spectate: available to all staff -->
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

          <!-- Lifecycle actions: super_admin only, and never on yourself -->
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
      </div>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <!-- Profile -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Profile</CardTitle>
          </CardHeader>
          <CardContent class="space-y-3 text-sm">
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Email</span>
              <span class="font-medium">{{ user.email }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Status</span>
              <Badge :variant="statusVariant">{{ user.status }}</Badge>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Staff role</span>
              <span class="font-medium">{{ user.staff_role || "—" }}</span>
            </div>
            <div class="flex justify-between gap-4">
              <span class="text-muted-foreground">Joined</span>
              <span class="font-medium">
                {{
                  user.created_at
                    ? new Date(user.created_at).toLocaleDateString()
                    : "—"
                }}
              </span>
            </div>
          </CardContent>
        </Card>

        <!-- Teams + subscriptions -->
        <Card>
          <CardHeader>
            <CardTitle class="text-base">Teams &amp; subscriptions</CardTitle>
          </CardHeader>
          <CardContent>
            <TeamsCell v-if="user.teams.length" :value="user.teams" />
            <p v-else class="text-sm text-muted-foreground">
              This user does not own any teams.
            </p>
          </CardContent>
        </Card>
      </div>
    </template>
  </div>
</template>
