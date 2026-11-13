<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import type { Team } from "~/types";

const { t } = useI18n();
const { updateTeam } = useTeams();
const { user, fetchUser } = useAuth();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const name = ref("");
const trimmedName = computed(() => name.value.trim());
const nameLength = computed(() => Array.from(trimmedName.value).length);
const validName = computed(
  () => nameLength.value >= 2 && nameLength.value <= 255,
);

const canSubmit = computed(() => {
  return validName.value && !isLoading.value;
});

watch(open, (isOpen) => {
  if (!isOpen) name.value = "";
});

const onSubmit = async () => {
  if (!canSubmit.value) return;

  isLoading.value = true;
  try {
    const { data: team } = await $api<{ data: Team }>("/teams", {
      method: "POST",
      body: { name: trimmedName.value },
    });
    updateTeam(team);
    if (!user.value?.current_team_id) await fetchUser();
    toast.success(t("settings.teamDialogs.created"));
    open.value = false;
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(
        fetchError.data?.message || t("settings.teamDialogs.createFailed"),
      );
    } else {
      toast.error(t("settings.teamDialogs.createFailed"));
    }
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger v-if="$slots.default" as-child>
      <slot />
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ t("settings.teamDialogs.createTitle") }}</DialogTitle>
        <DialogDescription>
          {{ t("settings.teamDialogs.createDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="team-name">{{
            t("settings.teamDialogs.teamName")
          }}</Label>
          <Input
            id="team-name"
            v-model="name"
            :placeholder="t('settings.teamDialogs.teamNamePlaceholder')"
            autocomplete="off"
            :aria-invalid="nameLength > 0 && !validName"
          />
          <p
            v-if="nameLength > 0 && !validName"
            class="text-sm text-destructive"
          >
            {{ t("settings.teamDialogs.nameLength") }}
          </p>
        </div>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("settings.teamDialogs.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
