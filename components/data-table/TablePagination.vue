<script setup lang="ts">
import { computed } from "vue";
import { Button } from "~/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { PaginationData } from "~/types/data-table";

const { t } = useI18n();

const props = defineProps<{
  pagination: PaginationData;
  perPageOptions: number[];
}>();

const emit = defineEmits<{
  page: [page: number];
  perPage: [value: number];
}>();

const pages = computed(() => {
  const { currentPage, lastPage } = props.pagination;
  if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);

  const pages: (number | string)[] = [1];
  if (currentPage > 3) pages.push("...");

  const start = Math.max(2, currentPage - 1);
  const end = Math.min(lastPage - 1, currentPage + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (currentPage < lastPage - 2) pages.push("...");
  pages.push(lastPage);

  return pages;
});
</script>
<template>
  <div class="flex items-center justify-between px-1 pt-4 pb-1">
    <div class="text-sm text-muted-foreground">
      <template v-if="pagination.total > 0">
        {{
          t("data.pagination.showing", {
            from: pagination.from,
            to: pagination.to,
            total: pagination.total,
          })
        }}
      </template>
    </div>

    <div class="flex items-center gap-2">
      <Select
        :model-value="String(pagination.perPage)"
        @update:model-value="emit('perPage', Number($event))"
      >
        <SelectTrigger class="w-[130px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in perPageOptions"
            :key="opt"
            :value="String(opt)"
          >
            {{ t("data.pagination.perPage", { count: opt }) }}
          </SelectItem>
        </SelectContent>
      </Select>

      <div v-if="pagination.type === 'full'" class="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="bg-card shadow-none"
          :disabled="pagination.currentPage <= 1"
          @click="emit('page', pagination.currentPage - 1)"
        >
          {{ t("data.pagination.prev") }}
        </Button>
        <template v-for="p in pages" :key="p">
          <span v-if="p === '...'" class="px-2 text-sm text-muted-foreground"
            >...</span
          >
          <Button
            v-else
            size="sm"
            :variant="p === pagination.currentPage ? 'default' : 'outline'"
            :class="
              p === pagination.currentPage
                ? 'min-w-9 shadow-none'
                : 'min-w-9 bg-card shadow-none'
            "
            @click="emit('page', p as number)"
          >
            {{ p }}
          </Button>
        </template>
        <Button
          variant="outline"
          size="sm"
          class="bg-card shadow-none"
          :disabled="pagination.currentPage >= pagination.lastPage"
          @click="emit('page', pagination.currentPage + 1)"
        >
          {{ t("data.pagination.next") }}
        </Button>
      </div>

      <div v-else class="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          class="bg-card shadow-none"
          :disabled="pagination.currentPage <= 1"
          @click="emit('page', pagination.currentPage - 1)"
        >
          {{ t("data.pagination.previous") }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="bg-card shadow-none"
          :disabled="
            !pagination.nextCursor &&
            pagination.currentPage >= pagination.lastPage
          "
          @click="emit('page', pagination.currentPage + 1)"
        >
          {{ t("data.pagination.next") }}
        </Button>
      </div>
    </div>
  </div>
</template>
