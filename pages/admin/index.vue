<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { User } from "~/types";
import { adminService } from "~/services/adminService";
import { useImpersonation } from "~/composables/useImpersonation";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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

const users = ref<User[]>([]);
const isLoading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);
const spectatingId = ref<string | number | null>(null);

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

const spectate = async (target: User) => {
  spectatingId.value = target.id;
  try {
    await start(target.id, "Staff support session");
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to start spectate session");
    spectatingId.value = null;
  }
};

const staffBadgeVariant = (role?: string | null) => {
  if (role === "super_admin") return "destructive";
  if (role === "support") return "blue";
  return "secondary";
};

const formatDate = (date: string): string => {
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(() => fetchUsers());
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Admin — Users</h1>
        <p class="text-sm text-muted-foreground">
          Browse users and spectate (read-only) as any user for support.
        </p>
      </div>
      <NuxtLink to="/admin/servers">
        <Button variant="outline" size="sm">
          <Icon name="lucide:server" class="h-4 w-4" />
          Servers
        </Button>
      </NuxtLink>
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
            <TableHead>ID</TableHead>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Staff Role</TableHead>
            <TableHead>Created</TableHead>
            <TableHead class="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="u in users" :key="u.id">
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ u.id }}
            </TableCell>
            <TableCell class="font-medium">{{ u.name }}</TableCell>
            <TableCell class="text-muted-foreground">{{ u.email }}</TableCell>
            <TableCell>
              <Badge
                v-if="u.staff_role"
                :variant="staffBadgeVariant(u.staff_role)"
              >
                {{ u.staff_role }}
              </Badge>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(u.created_at) }}
            </TableCell>
            <TableCell class="text-right">
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
            </TableCell>
          </TableRow>

          <TableRow v-if="users.length === 0">
            <TableCell
              colspan="6"
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
    </template>
  </div>
</template>
