<script setup lang="ts">
import { ref, watch } from "vue";
import { Check, ChevronsUpDown, Globe, LockKeyhole } from "lucide-vue-next";
import { Button } from "~/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { Repository } from "~/types";

const props = defineProps<{
  id: string;
  modelValue: Repository | null;
  repositories: Repository[];
  disabled?: boolean;
  placeholder: string;
  emptyText: string;
  label: string;
}>();
const emit = defineEmits<{ "update:modelValue": [repository: Repository] }>();
const searchTerm = defineModel<string>("searchTerm", { default: "" });
const open = ref(false);

const select = (repository: Repository) => {
  if (
    props.disabled ||
    !props.repositories.some((item) => item.id === repository.id)
  )
    return;
  emit("update:modelValue", repository);
  open.value = false;
};

watch(open, () => {
  searchTerm.value = "";
});
watch(
  () => props.disabled,
  (disabled) => {
    if (disabled) open.value = false;
  },
);
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        :id="id"
        type="button"
        variant="outline"
        role="combobox"
        :aria-expanded="open"
        :aria-label="label"
        :disabled="disabled"
        class="h-10 w-full min-w-0 justify-between gap-2 font-normal"
      >
        <span
          class="truncate"
          :class="{ 'text-muted-foreground': !modelValue }"
        >
          {{ modelValue?.full_name || placeholder }}
        </span>
        <ChevronsUpDown
          class="h-4 w-4 shrink-0 opacity-50"
          aria-hidden="true"
        />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="z-[200] w-[--reka-popover-trigger-width] p-0"
    >
      <Command :model-value="modelValue?.id">
        <CommandInput
          v-model="searchTerm"
          :placeholder="placeholder"
          :aria-label="label"
        />
        <CommandList>
          <CommandEmpty>{{ emptyText }}</CommandEmpty>
          <p
            v-if="!repositories.length && !searchTerm"
            class="py-6 text-center text-sm text-muted-foreground"
          >
            {{ emptyText }}
          </p>
          <CommandGroup>
            <CommandItem
              v-for="repository in repositories"
              :key="repository.id"
              :value="repository.id"
              @select="select(repository)"
            >
              <Check
                class="h-4 w-4"
                :class="{ 'opacity-0': modelValue?.id !== repository.id }"
                aria-hidden="true"
              />
              <component
                :is="repository.public ? Globe : LockKeyhole"
                class="h-4 w-4 text-muted-foreground"
                aria-hidden="true"
              />
              <span class="truncate">{{ repository.full_name }}</span>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </Command>
    </PopoverContent>
  </Popover>
</template>
