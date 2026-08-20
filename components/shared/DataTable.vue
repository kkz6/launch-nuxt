<script setup lang="ts" generic="T extends object">
import { formatDistanceToNow } from "date-fns";
import { enUS, ja } from "date-fns/locale";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Button } from "~/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

export interface Column<T> {
  key: keyof T | string;
  label: string;
  width?: string;
  className?: string;
  hideOnMobile?: boolean;
  type?: "text" | "date" | "relative-date" | "two-line" | "badge";
  secondaryKey?: string;
  render?: (value: unknown, item: T) => unknown;
}

export interface Action<T> {
  label: string;
  icon?: string;
  onClick?: (item: T) => void | Promise<void>;
  variant?: "default" | "destructive" | "ghost" | "outline";
  size?: "sm" | "icon" | "default";
  className?: string;
  show?: (item: T) => boolean;
  destructive?: boolean;
}

interface Props {
  data: T[];
  columns: Column<T>[];
  actions?: Action<T>[];
  actionsLabel?: string;
  emptyIcon?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  loadingText?: string;
  mobileBreakpoint?: "sm" | "md" | "lg";
}

const { locale, t } = useI18n();

const props = withDefaults(defineProps<Props>(), {
  actions: () => [],
  emptyIcon: "lucide:inbox",
  emptyDescription: "",
  loading: false,
  mobileBreakpoint: "md",
});

const resolvedActionsLabel = computed(
  () => props.actionsLabel || t("data.actions"),
);
const resolvedEmptyTitle = computed(() => props.emptyTitle || t("data.noData"));
const resolvedLoadingText = computed(
  () => props.loadingText || t("data.loadingData"),
);
const dateLocale = computed(() => (locale.value === "ja" ? ja : enUS));
const dateLocaleTag = computed(() =>
  locale.value === "ja" ? "ja-JP" : "en-US",
);

defineSlots<{
  empty(): unknown;
  actions(props: { item: T }): unknown;
  [key: `cell-${string}`]: (props: { row: T; value: unknown }) => unknown;
}>();

const getValue = (item: T, key: string): unknown => {
  if (key.includes(".")) {
    return key
      .split(".")
      .reduce<unknown>(
        (obj, k) => (obj as Record<string, unknown>)?.[k],
        item as unknown,
      );
  }
  return item[key as keyof T];
};

const formatColumnValue = (column: Column<T>, value: unknown): string => {
  if (value === null || value === undefined) return "-";

  switch (column.type) {
    case "relative-date":
      try {
        return formatDistanceToNow(new Date(String(value)), {
          addSuffix: true,
          locale: dateLocale.value,
        });
      } catch {
        return "-";
      }
    case "date":
      try {
        return new Date(String(value)).toLocaleDateString(dateLocaleTag.value);
      } catch {
        return "-";
      }
    default:
      return String(value);
  }
};

const mobileClass = computed(() => {
  switch (props.mobileBreakpoint) {
    case "sm":
      return { desktop: "hidden sm:block", mobile: "sm:hidden" };
    case "lg":
      return { desktop: "hidden lg:block", mobile: "lg:hidden" };
    default:
      return { desktop: "hidden md:block", mobile: "md:hidden" };
  }
});
</script>

<template>
  <div class="w-full">
    <!-- Loading State -->
    <div v-if="loading" class="space-y-3 p-2">
      <div class="flex items-center justify-center gap-3 py-8">
        <Icon
          name="lucide:loader-2"
          class="h-6 w-6 animate-spin text-primary"
        />
        <span class="text-sm text-muted-foreground">{{
          resolvedLoadingText
        }}</span>
      </div>
      <div class="space-y-2">
        <div v-for="i in 3" :key="i" class="animate-pulse">
          <div
            class="h-12 rounded-lg bg-gradient-to-r from-muted/50 to-muted/30"
          />
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <SharedEmptyState
      v-else-if="data.length === 0"
      :icon="emptyIcon"
      :title="resolvedEmptyTitle"
      :description="emptyDescription"
    >
      <slot name="empty" />
    </SharedEmptyState>

    <!-- Data Table -->
    <template v-else>
      <!-- Desktop Table -->
      <div :class="mobileClass.desktop">
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead
                v-for="column in columns"
                :key="String(column.key)"
                :style="{ width: column.width }"
                :class="['font-semibold text-foreground', column.className]"
              >
                {{ column.label }}
              </TableHead>
              <TableHead
                v-if="actions.length > 0 || $slots.actions"
                class="w-[120px] text-center font-semibold text-foreground"
              >
                {{ resolvedActionsLabel }}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow
              v-for="(item, index) in data"
              :key="index"
              class="border-b transition-colors duration-150 last:border-b-0 hover:bg-muted/20"
            >
              <TableCell
                v-for="column in columns"
                :key="String(column.key)"
                :class="['py-2', column.className]"
              >
                <slot
                  :name="`cell-${String(column.key)}`"
                  :row="item"
                  :value="getValue(item, String(column.key))"
                >
                  <template v-if="column.render">
                    <component
                      :is="
                        () =>
                          column.render!(
                            getValue(item, String(column.key)),
                            item,
                          )
                      "
                    />
                  </template>
                  <template v-else-if="column.type === 'two-line'">
                    <div class="flex flex-col">
                      <span class="font-medium">{{
                        getValue(item, String(column.key)) || "-"
                      }}</span>
                      <span
                        v-if="column.secondaryKey"
                        class="text-sm text-muted-foreground"
                      >
                        {{ getValue(item, column.secondaryKey) || "" }}
                      </span>
                    </div>
                  </template>
                  <template v-else>
                    <span class="text-sm">
                      {{
                        formatColumnValue(
                          column,
                          getValue(item, String(column.key)),
                        )
                      }}
                    </span>
                  </template>
                </slot>
              </TableCell>
              <TableCell
                v-if="actions.length > 0 || $slots.actions"
                class="py-2"
              >
                <div class="flex items-center justify-center gap-1">
                  <slot name="actions" :item="item">
                    <!--
                      Each icon-only action button is wrapped in a Tooltip
                      so users get a discoverable label on hover — the
                      icon alone (trash, play, pencil, …) leaves people
                      guessing what each row action does. The native
                      `title` attribute is also set as a non-JS fallback.
                      The mobile layout below shows the label inline and
                      doesn't need a tooltip.
                    -->
                    <TooltipProvider :delay-duration="200">
                      <template
                        v-for="(action, actionIndex) in actions"
                        :key="actionIndex"
                      >
                        <Tooltip v-if="!action.show || action.show(item)">
                          <TooltipTrigger as-child>
                            <Button
                              :variant="action.variant || 'ghost'"
                              :size="action.size || 'icon'"
                              :class="[
                                'transition-all duration-150 hover:scale-105',
                                action.destructive &&
                                  'hover:bg-destructive/90 hover:text-white',
                                action.className,
                              ]"
                              :title="action.label"
                              :aria-label="action.label"
                              @click="action.onClick?.(item)"
                            >
                              <Icon
                                v-if="action.icon"
                                :name="action.icon"
                                class="h-4 w-4"
                              />
                              <Icon
                                v-else
                                name="lucide:more-horizontal"
                                class="h-4 w-4"
                              />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            {{ action.label }}
                          </TooltipContent>
                        </Tooltip>
                      </template>
                    </TooltipProvider>
                  </slot>
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <!-- Mobile Cards -->
      <div :class="['space-y-3', mobileClass.mobile]">
        <div
          v-for="(item, index) in data"
          :key="index"
          class="space-y-2 rounded-lg border bg-card p-3 transition-all duration-200 hover:border-primary/20"
        >
          <div class="space-y-1.5">
            <div
              v-for="column in columns.filter((c) => !c.hideOnMobile)"
              :key="String(column.key)"
              class="flex items-start justify-between gap-2"
            >
              <span class="shrink-0 text-sm font-medium text-muted-foreground">
                {{ column.label }}
              </span>
              <div
                class="min-w-0 flex-1 text-right text-sm font-medium break-all"
              >
                <slot
                  :name="`cell-${String(column.key)}`"
                  :row="item"
                  :value="getValue(item, String(column.key))"
                >
                  {{
                    formatColumnValue(
                      column,
                      getValue(item, String(column.key)),
                    )
                  }}
                </slot>
              </div>
            </div>
          </div>
          <div
            v-if="actions.length > 0 || $slots.actions"
            class="flex items-center gap-2 border-t pt-2"
          >
            <slot name="actions" :item="item">
              <template
                v-for="(action, actionIndex) in actions"
                :key="actionIndex"
              >
                <Button
                  v-if="!action.show || action.show(item)"
                  :variant="action.variant || 'outline'"
                  :size="action.size || 'sm'"
                  class="flex-1 transition-all duration-150 hover:scale-[1.02]"
                  @click="action.onClick?.(item)"
                >
                  <Icon
                    v-if="action.icon"
                    :name="action.icon"
                    class="mr-2 h-4 w-4"
                  />
                  {{ action.label }}
                </Button>
              </template>
            </slot>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
