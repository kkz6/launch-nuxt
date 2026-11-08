<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AdminStaffRole } from "~/types";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

const props = defineProps<{
  role?: AdminStaffRole | null;
  isSelf: boolean;
  disabled: boolean;
  busy: boolean;
  error: string;
}>();
const emit = defineEmits<{ save: [role: AdminStaffRole | null] }>();
const { t } = useI18n();
const selected = ref<AdminStaffRole | "regular">(props.role || "regular");
watch(
  () => props.role,
  (role) => {
    selected.value = role || "regular";
  },
);
const unchanged = computed(() => selected.value === (props.role || "regular"));

function save(): void {
  if (props.disabled || props.isSelf || unchanged.value) return;
  emit("save", selected.value === "regular" ? null : selected.value);
}
</script>

<template>
  <section aria-labelledby="staff-access-label" class="min-w-0">
    <form
      class="flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
      @submit.prevent="save"
    >
      <div class="min-w-0 space-y-1.5">
        <Label
          id="staff-access-label"
          for="staff-access"
          class="text-sm font-semibold"
          >{{ t("admin.userDetail.staffAccess") }}</Label
        >
        <p class="max-w-xl text-xs leading-relaxed text-muted-foreground">
          {{ t("admin.userDetail.staffAccessDescription") }}
        </p>
        <p
          v-if="isSelf"
          id="staff-access-help"
          class="max-w-xl text-xs leading-relaxed text-muted-foreground"
        >
          {{ t("admin.userDetail.selfRoleGuard") }}
        </p>
      </div>
      <div class="flex shrink-0 items-center gap-2">
        <Select v-model="selected" :disabled="disabled || isSelf">
          <SelectTrigger
            id="staff-access"
            class="h-9 w-full min-w-0 bg-background shadow-none md:w-40"
            :aria-describedby="isSelf ? 'staff-access-help' : undefined"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="regular">{{
              t("admin.userDetail.regularUser")
            }}</SelectItem>
            <SelectItem value="support">{{
              t("admin.statuses.staffRole.support")
            }}</SelectItem>
            <SelectItem value="super_admin">{{
              t("admin.statuses.staffRole.super_admin")
            }}</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="sm"
          :disabled="disabled || isSelf || unchanged"
        >
          <Icon
            v-if="busy"
            name="lucide:loader-2"
            class="h-4 w-4 animate-spin"
          />
          {{ t("admin.userDetail.saveRole") }}
        </Button>
      </div>
    </form>
    <p v-if="error" role="alert" class="mt-3 text-sm text-destructive">
      {{ error }}
    </p>
  </section>
</template>
