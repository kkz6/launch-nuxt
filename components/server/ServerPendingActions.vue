<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "~/components/ui/alert-dialog";
import type { Server } from "~/types";
import { serverService } from "~/services/serverService";

interface Props {
  server: Server;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  provision: [server: Server];
  deleted: [serverId: string];
  viewLogs: [server: Server];
  retryProvision: [server: Server];
}>();

const showDeleteDialog = ref(false);
const isDeleting = ref(false);

// Check if server can be deleted (not during active provisioning)
const canDelete = computed(() => {
  return ["new", "starting", "failed", "awaiting_connection"].includes(
    props.server.status,
  );
});

// Check if this is a custom server that needs manual provisioning.
// Drives the Provision button on the card; the dialog it opens now
// owns the Try Connection step as well.
const isCustomServerPending = computed(() => {
  return (
    props.server.provider === "custom_server" && props.server.provision_command
  );
});

// Check if retry provision is available (failed status + connected)
const canRetryProvision = computed(() => {
  return props.server.status === "failed" && props.server.connected;
});

const handleProvision = () => {
  emit("provision", props.server);
};

const handleRetryProvision = () => {
  emit("retryProvision", props.server);
};

const handleViewLogs = () => {
  emit("viewLogs", props.server);
};

const handleDelete = async () => {
  isDeleting.value = true;
  try {
    await serverService.delete(props.server.id);
    toast.success(t("server.pending.deleted"));
    emit("deleted", props.server.id);
    showDeleteDialog.value = false;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("server.pending.deleteFailed"));
  } finally {
    isDeleting.value = false;
  }
};
</script>

<template>
  <div
    :class="[
      'pointer-events-auto flex items-center',
      // gap-0 is the joined split-button look — only applies when the
      // Provision pill is glued to the dots menu in custom-server pending
      // states. Every other state (failed shows two independent buttons,
      // new/starting shows just the dots menu) wants the standard 1.5
      // gap so the buttons don't visually merge.
      server.status !== 'failed' && isCustomServerPending ? 'gap-0' : 'gap-1.5',
    ]"
  >
    <!-- Failed servers get inline, discoverable actions. View Logs is the
         primary affordance (it opens the friendly error sheet with the
         Try-again / Manage-credentials buttons), Delete is destructive and
         confirmed in a dialog. Hiding these behind a dots menu tested badly
         — users didn't notice them at all. Label intentionally matches the
         dots-menu entry ("View Logs") so the two surfaces aren't naming the
         same action two different ways. -->
    <template v-if="server.status === 'failed'">
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1.5 px-2.5 text-xs"
        @click.prevent="handleViewLogs"
      >
        <Icon name="lucide:scroll-text" class="h-3 w-3" />
        {{ t("server.pending.viewLogs") }}
      </Button>
      <Button
        variant="outline"
        size="sm"
        class="h-7 gap-1.5 border-destructive/30 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive"
        @click.prevent="showDeleteDialog = true"
      >
        <Icon name="lucide:trash-2" class="h-3 w-3" />
        {{ t("server.common.delete") }}
      </Button>
    </template>

    <!-- All other transitional states (new, starting, custom-server pending)
         keep the compact dots menu so the card doesn't grow taller. -->
    <template v-else>
      <!--
        Single Provision button for custom servers awaiting connection.
        Try Connection lives inside the dialog this opens — the user
        copies the command, runs it on their box, and clicks Try
        Connection right there without ever leaving the dialog. Keeping
        both actions in one workflow surface stops new users from
        clicking Try Connection on the card before they've even seen
        the script they were supposed to run.
      -->
      <!--
        Tint matches the yellow dot the server card already shows in
        awaiting_connection state (see pages/servers/index.vue:135-136).
        Same colour family = same "you have a pending action" signal,
        so the user's eye threads dot → button without a translation
        step. Full border (not the variant default's borderless filled
        look) so the split with the adjacent dots menu reads as one
        joined control instead of a button next to a bordered orphan.
      -->
      <Button
        v-if="isCustomServerPending"
        size="sm"
        class="h-7 gap-1.5 rounded-r-none border border-r-0 border-yellow-300 bg-yellow-50 px-2.5 text-xs text-yellow-900 hover:bg-yellow-100 dark:border-yellow-800/60 dark:bg-yellow-950/40 dark:text-yellow-200 dark:hover:bg-yellow-900/40"
        @click.prevent="handleProvision"
      >
        <Icon name="lucide:terminal" class="h-3 w-3" />
        {{ t("server.pending.provision") }}
      </Button>

      <!-- Dropdown Menu — uses the conventional "more actions" dots icon
           instead of a generic chevron-down, which read as an "expand row"
           affordance in user testing. When the Provision tint is on the
           left, the dots button picks up the same yellow border colour
           so the split-button looks like a single unified control. -->
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :class="[
              'h-7 w-7 p-0',
              isCustomServerPending
                ? 'rounded-l-none border-yellow-300 dark:border-yellow-800/60'
                : '',
            ]"
            :aria-label="t('server.pending.moreActions')"
            :title="t('server.pending.moreActions')"
            @click.prevent
          >
            <Icon name="lucide:more-horizontal" class="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-40">
          <!-- View Logs -->
          <DropdownMenuItem @click.prevent="handleViewLogs">
            <Icon name="lucide:scroll-text" class="mr-2 h-4 w-4" />
            {{ t("server.pending.viewLogs") }}
          </DropdownMenuItem>

          <!-- Retry Provision (only for failed servers that connected) -->
          <DropdownMenuItem
            v-if="canRetryProvision"
            @click.prevent="handleRetryProvision"
          >
            <Icon name="lucide:refresh-cw" class="mr-2 h-4 w-4" />
            {{ t("server.pending.retryProvision") }}
          </DropdownMenuItem>

          <DropdownMenuSeparator />

          <!-- Delete -->
          <DropdownMenuItem
            :disabled="!canDelete"
            class="text-destructive focus:text-destructive"
            @click.prevent="showDeleteDialog = true"
          >
            <Icon name="lucide:trash-2" class="mr-2 h-4 w-4" />
            {{ t("server.common.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </template>

    <!-- Delete Confirmation Dialog -->
    <AlertDialog v-model:open="showDeleteDialog">
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{{
            t("server.pending.deleteTitle")
          }}</AlertDialogTitle>
          <AlertDialogDescription>
            {{ t("server.pending.deletePrefix") }}
            <strong>{{ server.name }}</strong
            >?
            {{ t("server.pending.deleteSuffix") }}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel :disabled="isDeleting">{{
            t("server.common.cancel")
          }}</AlertDialogCancel>
          <AlertDialogAction
            :disabled="isDeleting"
            class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            @click.prevent="handleDelete"
          >
            <Icon
              v-if="isDeleting"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ t("server.common.delete") }}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </div>
</template>
