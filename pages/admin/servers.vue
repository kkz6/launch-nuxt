<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { Server } from "~/types";
import { adminService } from "~/services/adminService";
import { Button } from "~/components/ui/button";
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
  title: "Admin — Servers",
});

const PER_PAGE = 20;

const servers = ref<Server[]>([]);
const isLoading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);

const fetchServers = async (page = 1) => {
  isLoading.value = true;
  try {
    const response = await adminService.servers({
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    });
    servers.value = response.data;
    total.value = response.meta?.total ?? response.data.length;
    lastPage.value = response.meta?.last_page ?? 1;
    currentPage.value = response.meta?.current_page ?? page;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load servers");
  } finally {
    isLoading.value = false;
  }
};

const goToPage = (page: number) => {
  if (page < 1 || page > lastPage.value) return;
  fetchServers(page);
};

const formatDate = (date?: string): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(() => fetchServers());
</script>

<template>
  <div class="space-y-6 pb-10">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold">Admin — Servers</h1>
        <p class="text-sm text-muted-foreground">All servers across teams.</p>
      </div>
      <NuxtLink to="/admin">
        <Button variant="outline" size="sm">
          <Icon name="lucide:users" class="h-4 w-4" />
          Users
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
            <TableHead>Provider</TableHead>
            <TableHead>IP</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="s in servers" :key="s.id">
            <TableCell class="font-mono text-xs text-muted-foreground">
              {{ s.id }}
            </TableCell>
            <TableCell class="font-medium">{{ s.name }}</TableCell>
            <TableCell class="text-muted-foreground">
              {{ s.provider_label || s.provider }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ s.public_ipv4 || "—" }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ s.status_label || s.status }}
            </TableCell>
            <TableCell class="text-muted-foreground">
              {{ formatDate(s.created_at) }}
            </TableCell>
          </TableRow>

          <TableRow v-if="servers.length === 0">
            <TableCell
              colspan="6"
              class="py-10 text-center text-muted-foreground"
            >
              No servers found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="lastPage > 1"
        class="flex items-center justify-between text-sm text-muted-foreground"
      >
        <span>{{ total }} servers</span>
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
