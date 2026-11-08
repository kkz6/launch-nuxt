<script setup lang="ts">
import { computed, ref } from "vue";
import type { AdminServerSummary } from "~/types";
import { Badge, type BadgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";

const props = defineProps<{
  servers: AdminServerSummary[];
  loading: boolean;
  loaded: boolean;
}>();
const { t, te } = useI18n();
const search = ref("");
const providerLabels = computed<Record<string, string>>(() => ({
  digitalocean: "DigitalOcean",
  hetzner: "Hetzner",
  linode: "Linode",
  vultr: "Vultr",
  aws: "AWS",
  custom_server: t("common.customServer"),
}));
const providerLabel = (provider: string): string =>
  providerLabels.value[provider] || provider.replace(/_/g, " ");
const filteredServers = computed(() => {
  const query = search.value.trim().toLocaleLowerCase();
  return props.servers.filter((server) =>
    `${server.name} ${server.public_ipv4 || ""} ${server.provider} ${providerLabel(server.provider)}`
      .toLocaleLowerCase()
      .includes(query),
  );
});
const statusLabel = (status: string): string => {
  const key = `admin.statuses.server.${status}`;
  return te(key) ? t(key) : status.replace(/_/g, " ");
};
const statusVariant = (
  server: AdminServerSummary,
): BadgeVariants["variant"] => {
  if (server.status === "running") return server.connected ? "green" : "blank";
  if (["failed", "deleting"].includes(server.status)) return "red";
  if (["awaiting_connection", "paused"].includes(server.status))
    return "orange";
  if (["new", "starting", "provisioning"].includes(server.status))
    return "blue";
  return "blank";
};
</script>

<template>
  <div class="space-y-3">
    <div class="relative w-full sm:w-72">
      <Label for="admin-server-search" class="sr-only">{{
        t("admin.userDetail.searchServers")
      }}</Label>
      <Icon
        name="lucide:search"
        class="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground"
        aria-hidden="true"
      />
      <Input
        id="admin-server-search"
        v-model="search"
        type="search"
        class="h-9 pl-9"
        :placeholder="t('admin.userDetail.searchServersPlaceholder')"
      />
    </div>
    <div
      v-if="loading && !loaded"
      role="status"
      class="flex items-center justify-center py-12"
      :aria-label="t('server.common.loading')"
    >
      <Icon
        name="lucide:loader-2"
        class="h-5 w-5 animate-spin text-muted-foreground"
        aria-hidden="true"
      />
    </div>
    <div v-else-if="filteredServers.length" class="[&>div]:overflow-x-auto">
      <Table class="min-w-[620px]">
        <TableHeader>
          <TableRow
            class="bg-muted/40 hover:bg-muted/40 [&>th]:h-10 [&>th]:text-xs"
          >
            <TableHead>{{ t("server.common.name") }}</TableHead>
            <TableHead>{{ t("admin.userDetail.providerColumn") }}</TableHead>
            <TableHead>{{ t("admin.serverDetail.publicIpv4") }}</TableHead>
            <TableHead>{{ t("server.common.status") }}</TableHead>
            <TableHead class="w-14 text-right">
              <span class="sr-only">{{ t("server.common.action") }}</span>
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="server in filteredServers"
            :key="server.id"
            class="transition-colors duration-150 last:border-b-0 hover:bg-muted/20"
          >
            <TableCell class="py-2 font-medium">
              <NuxtLink
                :to="`/admin/servers/${server.id}`"
                class="underline-offset-4 hover:underline"
                >{{ server.name }}</NuxtLink
              >
            </TableCell>
            <TableCell class="py-2 text-muted-foreground">{{
              providerLabel(server.provider)
            }}</TableCell>
            <TableCell class="py-2 tabular-nums text-muted-foreground">{{
              server.public_ipv4 || "—"
            }}</TableCell>
            <TableCell class="py-2">
              <Badge :variant="statusVariant(server)">{{
                statusLabel(server.status)
              }}</Badge>
            </TableCell>
            <TableCell class="w-14 py-2 text-right">
              <TooltipProvider :delay-duration="200">
                <Tooltip>
                  <TooltipTrigger as-child>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      class="text-muted-foreground"
                      as-child
                    >
                      <NuxtLink
                        :to="`/admin/servers/${server.id}`"
                        :aria-label="
                          t('admin.userDetail.viewServerNamed', {
                            name: server.name,
                          })
                        "
                        :title="
                          t('admin.userDetail.viewServerNamed', {
                            name: server.name,
                          })
                        "
                      >
                        <Icon
                          name="lucide:arrow-up-right"
                          class="h-4 w-4"
                          aria-hidden="true"
                        />
                      </NuxtLink>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {{
                      t("admin.userDetail.viewServerNamed", {
                        name: server.name,
                      })
                    }}
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>
    <p v-else class="py-12 text-center text-sm text-muted-foreground">
      {{
        search.trim()
          ? t("admin.userDetail.noMatchingServers")
          : t("admin.userDetail.noServers")
      }}
    </p>
  </div>
</template>
