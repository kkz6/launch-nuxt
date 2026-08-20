<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import type { Server } from "~/types";

const servers = ref<Server[]>([]);
const { t } = useI18n();
const selectedServerId = ref("");
const auditEmail = ref("");
const auditLoading = ref(false);
const isLoadingServers = ref(true);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const fetchServers = async () => {
  isLoadingServers.value = true;
  try {
    const response = await $api<{ data: Server[] }>("/servers");
    servers.value = response.data.filter((s: Server) => s.connected);
  } catch {
    // Silent fail - select will show empty state
  } finally {
    isLoadingServers.value = false;
  }
};

const runVulnerabilityAudit = async () => {
  if (!selectedServerId.value) {
    toast.error(t("settings.security.selectServerRequired"));
    return;
  }

  if (!confirmationDialog.value) return;

  const server = servers.value.find((s) => s.id === selectedServerId.value);
  const result = await confirmationDialog.value.show({
    title: t("settings.security.startAuditTitle"),
    description: t("settings.security.startAuditDescription", {
      server: server?.name || t("settings.security.selectedServer"),
    }),
    confirmText: t("settings.security.startAudit"),
    cancelText: t("settings.security.cancel"),
  });

  if (!result.ok) return;

  auditLoading.value = true;
  try {
    const response = await $api<{ message: string }>(
      `/servers/${selectedServerId.value}/vulnerability-audit`,
      {
        method: "POST",
        body: auditEmail.value ? { email: auditEmail.value } : {},
      },
    );
    toast.success(response.message || t("settings.security.auditQueued"));
    auditEmail.value = "";
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    toast.error(err.data?.message || t("settings.security.auditFailed"));
  } finally {
    auditLoading.value = false;
  }
};

onMounted(fetchServers);
</script>

<template>
  <div class="divide-y">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Active Sessions Section -->
    <div class="px-6 pb-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.security.activeSessionsTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.security.activeSessionsDescription") }}
      </p>
      <SettingsSessions />
    </div>

    <!-- Passkeys Section -->
    <div class="px-6 py-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.security.passkeysTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.security.passkeysDescription") }}
      </p>
      <SettingsPasskeys />
    </div>

    <!-- Two-Factor Authentication Section -->
    <div class="px-6 py-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.security.twoFactorTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.security.twoFactorDescription") }}
      </p>
      <SettingsTwoFactor />
    </div>

    <!-- Personal Access Tokens Section -->
    <div class="px-6 py-6">
      <h3 class="mb-1 text-base font-semibold">
        {{ t("settings.security.tokensTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.security.tokensDescription") }}
      </p>
      <SettingsPersonalAccessTokens />
    </div>

    <!-- Server Security Audit Section -->
    <div class="px-6 pt-6">
      <h3 class="mb-1 flex items-center gap-2 text-base font-semibold">
        <Icon name="lucide:shield" class="h-4 w-4" />
        {{ t("settings.security.auditTitle") }}
      </h3>
      <p class="mb-4 text-sm text-muted-foreground">
        {{ t("settings.security.auditDescription") }}
      </p>

      <form class="space-y-4" @submit.prevent="runVulnerabilityAudit">
        <div class="space-y-2">
          <Label>{{ t("settings.security.server") }}</Label>
          <Select v-model="selectedServerId">
            <SelectTrigger>
              <SelectValue :placeholder="t('settings.security.selectServer')" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <template v-if="isLoadingServers">
                  <SelectLabel class="text-muted-foreground">{{
                    t("settings.security.loadingServers")
                  }}</SelectLabel>
                </template>
                <template v-else-if="servers.length > 0">
                  <SelectItem
                    v-for="server in servers"
                    :key="server.id"
                    :value="server.id"
                  >
                    {{ server.name }} ({{ server.public_ipv4 }})
                  </SelectItem>
                </template>
                <template v-else>
                  <SelectLabel class="text-muted-foreground">{{
                    t("settings.security.noConnectedServers")
                  }}</SelectLabel>
                </template>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="audit-email">{{
            t("settings.security.emailOptional")
          }}</Label>
          <Input
            id="audit-email"
            v-model="auditEmail"
            type="email"
            :placeholder="t('settings.security.emailPlaceholder')"
          />
        </div>

        <div
          class="flex items-start gap-3 rounded-lg bg-blue-50 p-4 dark:bg-blue-950/50"
        >
          <div class="space-y-1">
            <p class="text-sm font-medium text-blue-800 dark:text-blue-200">
              {{ t("settings.security.auditedTitle") }}
            </p>
            <ul
              class="list-inside list-disc space-y-1 text-sm text-blue-700 dark:text-blue-300"
            >
              <li>{{ t("settings.security.auditItems.updates") }}</li>
              <li>{{ t("settings.security.auditItems.ssh") }}</li>
              <li>{{ t("settings.security.auditItems.accounts") }}</li>
              <li>{{ t("settings.security.auditItems.network") }}</li>
              <li>{{ t("settings.security.auditItems.permissions") }}</li>
              <li>{{ t("settings.security.auditItems.services") }}</li>
              <li>{{ t("settings.security.auditItems.logs") }}</li>
            </ul>
          </div>
        </div>

        <Button type="submit" :disabled="auditLoading || !selectedServerId">
          <Icon
            v-if="auditLoading"
            name="lucide:loader-2"
            class="mr-2 h-4 w-4 animate-spin"
          />
          {{
            auditLoading
              ? t("settings.security.runningAudit")
              : t("settings.security.startSecurityAudit")
          }}
        </Button>
      </form>
    </div>
  </div>
</template>
