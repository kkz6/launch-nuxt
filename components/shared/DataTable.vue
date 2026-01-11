<script setup lang="ts" generic="T extends Record<string, unknown>">
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '~/components/ui/table'
import { Button } from '~/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '~/components/ui/dropdown-menu'

export interface Column<T> {
  key: keyof T | string
  label: string
  width?: string
  className?: string
  hideOnMobile?: boolean
  render?: (value: unknown, item: T) => unknown
}

export interface Action<T> {
  label: string
  icon?: string
  onClick?: (item: T) => void
  destructive?: boolean
}

interface Props {
  data: T[]
  columns: Column<T>[]
  actions?: Action<T>[]
  actionsLabel?: string
  emptyIcon?: string
  emptyTitle?: string
}

const props = withDefaults(defineProps<Props>(), {
  actions: () => [],
  actionsLabel: 'Actions',
  emptyIcon: 'lucide:inbox',
  emptyTitle: 'No data found',
})

defineSlots<{
  empty(): unknown
  actions(props: { item: T }): unknown
}>()

const getValue = (item: T, key: string): unknown => {
  if (key.includes('.')) {
    return key.split('.').reduce<unknown>((obj, k) => (obj as Record<string, unknown>)?.[k], item as unknown)
  }
  return item[key as keyof T]
}
</script>

<template>
  <div class="w-full">
    <div v-if="data.length === 0" class="flex flex-col items-center justify-center py-12 text-muted-foreground">
      <Icon :name="emptyIcon" class="mb-3 h-8 w-8" />
      <p class="mb-4 text-sm">{{ emptyTitle }}</p>
      <slot name="empty" />
    </div>

    <Table v-else>
      <TableHeader>
        <TableRow>
          <TableHead
            v-for="column in columns"
            :key="String(column.key)"
            :style="{ width: column.width }"
            :class="[column.className, { 'hidden sm:table-cell': column.hideOnMobile }]"
          >
            {{ column.label }}
          </TableHead>
          <TableHead v-if="actions.length > 0 || $slots.actions" class="w-[100px] text-right">
            {{ actionsLabel }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(item, index) in data" :key="index">
          <TableCell
            v-for="column in columns"
            :key="String(column.key)"
            :class="[column.className, { 'hidden sm:table-cell': column.hideOnMobile }]"
          >
            <template v-if="column.render">
              <component :is="() => column.render!(getValue(item, String(column.key)), item)" />
            </template>
            <template v-else>
              {{ getValue(item, String(column.key)) }}
            </template>
          </TableCell>
          <TableCell v-if="actions.length > 0 || $slots.actions" class="text-right">
            <slot name="actions" :item="item">
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="sm">
                    <Icon name="lucide:more-horizontal" class="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    v-for="action in actions"
                    :key="action.label"
                    :class="{ 'text-destructive': action.destructive }"
                    @click="action.onClick?.(item)"
                  >
                    <Icon v-if="action.icon" :name="action.icon" class="mr-2 h-4 w-4" />
                    {{ action.label }}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </slot>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
