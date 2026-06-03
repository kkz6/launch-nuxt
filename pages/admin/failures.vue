<script setup lang="ts">
import { formatDistanceToNow } from "date-fns";
import { toast } from "vue-sonner";
import type { AdminFailure } from "~/types";
import { adminService } from "~/services/adminService";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import type { BadgeVariants } from "~/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
  title: "Admin — Failures",
});

const PER_PAGE = 20;

const KIND_FILTERS = [
  { label: "All", value: "" },
  { label: "Provision", value: "provision" },
  { label: "Task", value: "task" },
  { label: "Deployment", value: "deployment" },
] as const;

const failures = ref<AdminFailure[]>([]);
const caveat = ref("");
const isLoading = ref(true);
const total = ref(0);
const currentPage = ref(1);
const lastPage = ref(1);
const activeKind = ref("");

const detailFailure = ref<AdminFailure | null>(null);
const detailOpen = ref(false);

const fetchFailures = async (page = 1) => {
  isLoading.value = true;
  try {
    const response = await adminService.failures({
      kind: activeKind.value || undefined,
      limit: PER_PAGE,
      offset: (page - 1) * PER_PAGE,
    });
    failures.value = response.data.failures;
    caveat.value = response.data.caveat;
    total.value = response.meta?.total ?? response.data.failures.length;
    lastPage.value = response.meta?.last_page ?? 1;
    currentPage.value = response.meta?.current_page ?? page;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || "Failed to load failures");
  } finally {
    isLoading.value = false;
  }
};

const setKind = (kind: string) => {
  if (activeKind.value === kind) return;
  activeKind.value = kind;
  fetchFailures(1);
};

const goToPage = (page: number) => {
  if (page < 1 || page > lastPage.value) return;
  fetchFailures(page);
};

const openDetail = (failure: AdminFailure) => {
  detailFailure.value = failure;
  detailOpen.value = true;
};

const kindVariant = (kind: string): BadgeVariants["variant"] => {
  if (kind === "provision") return "orange";
  if (kind === "deployment") return "blue";
  if (kind === "task") return "yellow";
  return "secondary";
};

const formatDate = (date?: string | null): string => {
  if (!date) return "";
  try {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
  } catch {
    return "";
  }
};

onMounted(() => fetchFailures());
</script>

<template>
  <div class="space-y-6 pb-10">
    <AdminTabs />

    <p class="text-sm text-muted-foreground">
      Recent provisioning, task, and deployment failures across the platform.
    </p>

    <div class="flex flex-wrap items-center gap-2">
      <Button
        v-for="f in KIND_FILTERS"
        :key="f.value"
        :variant="activeKind === f.value ? 'default' : 'outline'"
        size="sm"
        @click="setKind(f.value)"
      >
        {{ f.label }}
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
            <TableHead>Kind</TableHead>
            <TableHead>Title</TableHead>
            <TableHead>When</TableHead>
            <TableHead>Error</TableHead>
            <TableHead class="text-right">Details</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="f in failures" :key="`${f.kind}-${f.id}`">
            <TableCell>
              <Badge :variant="kindVariant(f.kind)">{{ f.kind }}</Badge>
            </TableCell>
            <TableCell class="font-medium">{{ f.title }}</TableCell>
            <TableCell class="whitespace-nowrap text-muted-foreground">
              {{ formatDate(f.when) }}
            </TableCell>
            <TableCell class="max-w-md truncate text-muted-foreground">
              {{ f.error }}
            </TableCell>
            <TableCell class="text-right">
              <Button
                v-if="f.detail"
                variant="outline"
                size="sm"
                @click="openDetail(f)"
              >
                <Icon name="lucide:file-text" class="h-4 w-4" />
                View
              </Button>
              <span v-else class="text-muted-foreground">—</span>
            </TableCell>
          </TableRow>

          <TableRow v-if="failures.length === 0">
            <TableCell
              colspan="5"
              class="py-10 text-center text-muted-foreground"
            >
              No failures found.
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <div
        v-if="lastPage > 1"
        class="flex items-center justify-between text-sm text-muted-foreground"
      >
        <span>{{ total }} failures</span>
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

      <p v-if="caveat" class="text-xs text-muted-foreground">
        {{ caveat }}
      </p>
    </template>

    <Dialog v-model:open="detailOpen">
      <DialogContent class="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{{ detailFailure?.title }}</DialogTitle>
          <DialogDescription>{{ detailFailure?.error }}</DialogDescription>
        </DialogHeader>
        <pre
          class="max-h-96 overflow-auto rounded-md bg-muted p-4 text-xs whitespace-pre-wrap"
          >{{ detailFailure?.detail }}</pre
        >
      </DialogContent>
    </Dialog>
  </div>
</template>
