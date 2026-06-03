<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { Team } from "~/types";
import { adminService } from "~/services/adminService";
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
  title: "Admin — Teams",
});

const PER_PAGE = 20;

const teams = ref<Team[]>([]);
const isLoading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);

const fetchTeams = async (page = 1) => {
  isLoading.value = true;
  try {
    const response = await adminService.teams({
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    });
    teams.value = response.data;
    total.value = response.meta?.total ?? response.data.length;
    lastPage.value = response.meta?.last_page ?? 1;
    currentPage.value = response.meta?.current_page ?? page;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load teams");
  } finally {
    isLoading.value = false;
  }
};

const goToPage = (page: number) => {
  if (page < 1 || page > lastPage.value) return;
  fetchTeams(page);
};

const formatDate = (date?: string): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(() => fetchTeams());
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <p class="text-sm text-muted-foreground">All teams across the platform.</p>

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
            <TableHead>Owner</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="t in teams" :key="t.id">
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ t.id }}
            </TableCell>
            <TableCell class="font-medium">{{ t.name }}</TableCell>
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ t.owner?.name || t.user_id }}
            </TableCell>
            <TableCell>
              <Badge v-if="t.personal_team" variant="secondary">Personal</Badge>
              <Badge v-else variant="outline">Team</Badge>
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(t.created_at) }}
            </TableCell>
          </TableRow>

          <TableRow v-if="teams.length === 0">
            <TableCell
              colspan="5"
              class="py-10 text-center text-muted-foreground"
            >
              No teams found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="lastPage > 1"
        class="flex items-center justify-between text-sm text-muted-foreground"
      >
        <span>{{ total }} teams</span>
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
