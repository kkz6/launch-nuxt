<script setup lang="ts">
import { Cloud, CloudOff, MessageSquare, AlertTriangle } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "~/components/ui/tooltip";

definePageMeta({
  layout: "default",
  middleware: "auth",
});

interface DnsRecord {
  id: string;
  type: string;
  name: string;
  value: string;
  ttl?: number;
  priority?: number;
  tag?: string;
  weight?: number;
  port?: number;
  flags?: number;
  comment?: string;
  proxied?: boolean;
}

interface Domain {
  id: string;
  label: string;
  address: string;
  nameservers?: string[];
  provider?: {
    provider: string;
    provider_label: string;
  };
}

const route = useRoute();
const domainId = computed(() => route.params.id as string);
const { t, locale } = useI18n();

const domain = ref<Domain | null>(null);
const records = ref<DnsRecord[]>([]);
const recordTypes = ref<string[]>([]);
const isLoading = ref(true);
const searchQuery = ref("");
const selectedRecords = ref<Set<string>>(new Set());
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

useHead({
  title: () =>
    t("operations.dns.records.pageTitle", {
      domain: domain.value?.address || t("operations.dns.common.domain"),
    }),
});

const localeTag = computed(() => (locale.value === "ja" ? "ja-JP" : "en-US"));
const numberFormatter = computed(() => new Intl.NumberFormat(localeTag.value));

// Separate NS records from other records
const nsRecords = computed(() => records.value.filter((r) => r.type === "NS"));
const editableRecords = computed(() =>
  records.value.filter((r) => r.type !== "NS"),
);

// Filter records by search query
const filteredRecords = computed(() => {
  if (!searchQuery.value) return editableRecords.value;
  const query = searchQuery.value.toLowerCase();
  return editableRecords.value.filter(
    (r) =>
      r.name.toLowerCase().includes(query) ||
      r.value.toLowerCase().includes(query) ||
      r.type.toLowerCase().includes(query),
  );
});

const isCloudflare = computed(
  () => domain.value?.provider?.provider === "cloudflare",
);

const fetchDomainData = async () => {
  try {
    const response = await $api<{
      data: {
        domain: Domain;
        records: DnsRecord[];
        recordTypes: Array<string | { value: string }>;
      };
    }>(`/dns/domains/${domainId.value}`);
    domain.value = response.data.domain;
    records.value = response.data.records || [];
    const rawTypes = response.data.recordTypes || [];
    recordTypes.value = rawTypes.map((recordType) =>
      typeof recordType === "string" ? recordType : recordType.value,
    );
  } catch {
    toast.error(t("operations.dns.records.loadError"));
    navigateTo("/dns");
  } finally {
    isLoading.value = false;
  }
};

const deleteRecord = async (record: DnsRecord) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("operations.dns.record.deleteTitle", { type: record.type }),
    description: t("operations.dns.record.deleteDescription", {
      type: record.type,
      name: record.name,
    }),
    confirmText: t("operations.dns.common.delete"),
    cancelText: t("operations.dns.common.cancel"),
    destructive: true,
  });

  if (result.ok) {
    try {
      await $api(`/dns/domains/${domainId.value}/records/${record.id}`, {
        method: "DELETE",
      });
      records.value = records.value.filter((r) => r.id !== record.id);
      toast.success(t("operations.dns.record.deleted"));
    } catch (error: unknown) {
      const err = error as { data?: { message?: string } };
      toast.error(err.data?.message || t("operations.dns.record.deleteError"));
    }
  }
};

const toggleSelectRecord = (recordId: string) => {
  if (selectedRecords.value.has(recordId)) {
    selectedRecords.value.delete(recordId);
  } else {
    selectedRecords.value.add(recordId);
  }
};

const toggleSelectAll = () => {
  if (selectedRecords.value.size === filteredRecords.value.length) {
    selectedRecords.value.clear();
  } else {
    selectedRecords.value = new Set(filteredRecords.value.map((r) => r.id));
  }
};

const formatTtl = (record: DnsRecord): string => {
  if (record.proxied && record.ttl === 1)
    return t("operations.dns.records.auto");
  if (!record.ttl || record.ttl <= 0) return "-";
  if (record.ttl === 1) return t("operations.dns.records.auto");

  const formatUnit = (key: string, count: number) =>
    t(key, { count: numberFormatter.value.format(count) });

  if (record.ttl < 60)
    return formatUnit("operations.dns.records.ttlSeconds", record.ttl);
  if (record.ttl < 3600) {
    return formatUnit(
      "operations.dns.records.ttlMinutes",
      Math.floor(record.ttl / 60),
    );
  }
  if (record.ttl < 86400) {
    return formatUnit(
      "operations.dns.records.ttlHours",
      Math.floor(record.ttl / 3600),
    );
  }
  return formatUnit(
    "operations.dns.records.ttlDays",
    Math.floor(record.ttl / 86400),
  );
};

// Check if record has potential issues (for warning icon)
const hasWarning = (record: DnsRecord): boolean => {
  // Example: CNAME records pointing to non-standard targets might have warnings
  return record.type === "CNAME" && !record.proxied;
};

onMounted(fetchDomainData);
</script>

<template>
  <div class="pb-10">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon
        name="lucide:loader-2"
        class="h-8 w-8 animate-spin text-muted-foreground"
      />
    </div>

    <template v-else-if="domain">
      <!-- Search and Add Record Bar -->
      <div class="mb-4 flex items-center gap-3">
        <div class="relative flex-1">
          <Icon
            name="lucide:search"
            class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            v-model="searchQuery"
            :placeholder="t('operations.dns.records.searchPlaceholder')"
            class="pl-9"
          />
        </div>
        <DnsRecordModal
          :domain="domain"
          :available-record-types="recordTypes.filter((t) => t !== 'NS')"
          :is-cloudflare="isCloudflare"
          @created="fetchDomainData"
        >
          <Button>
            <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
            {{ t("operations.dns.record.addButton") }}
          </Button>
        </DnsRecordModal>
      </div>

      <!-- DNS Records Section -->

      <!-- DNS Records Table -->
      <Table>
        <TableHeader>
          <TableRow class="bg-muted/40 hover:bg-muted/40">
            <TableHead class="w-12">
              <Checkbox
                :checked="
                  filteredRecords.length > 0 &&
                  selectedRecords.size === filteredRecords.length
                "
                :aria-label="t('operations.dns.records.selectAllAria')"
                @update:checked="toggleSelectAll"
              />
            </TableHead>
            <TableHead class="w-[120px]">
              <div class="flex items-center gap-1">
                {{ t("operations.dns.records.type") }}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon
                        name="lucide:info"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t("operations.dns.records.typeHelp") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <Icon
                  name="lucide:arrow-up"
                  class="ml-1 h-3 w-3 text-muted-foreground"
                />
              </div>
            </TableHead>
            <TableHead>
              <div class="flex items-center gap-1">
                {{ t("operations.dns.records.name") }}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon
                        name="lucide:info"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t("operations.dns.records.nameHelp") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead>
              <div class="flex items-center gap-1">
                {{ t("operations.dns.records.content") }}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon
                        name="lucide:info"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t("operations.dns.records.contentHelp") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead v-if="isCloudflare" class="w-[140px]">
              <div class="flex items-center gap-1">
                {{ t("operations.dns.records.proxyStatus") }}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon
                        name="lucide:info"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t("operations.dns.records.proxyStatusHelp") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead class="w-[100px]">
              <div class="flex items-center gap-1">
                {{ t("operations.dns.records.ttl") }}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Icon
                        name="lucide:info"
                        class="h-3.5 w-3.5 text-muted-foreground"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{{ t("operations.dns.records.ttlHelp") }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </TableHead>
            <TableHead class="w-[100px] text-right">
              {{ t("operations.dns.records.actions") }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow
            v-for="record in filteredRecords"
            :key="record.id"
            class="hover:bg-muted/20"
          >
            <TableCell>
              <Checkbox
                :checked="selectedRecords.has(record.id)"
                :aria-label="
                  t('operations.dns.records.selectRecordAria', {
                    type: record.type,
                    name: record.name,
                  })
                "
                @update:checked="toggleSelectRecord(record.id)"
              />
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <AlertTriangle
                  v-if="hasWarning(record)"
                  class="h-4 w-4 text-yellow-500"
                  :aria-label="t('operations.dns.records.warningAria')"
                />
                <span class="font-medium">{{ record.type }}</span>
              </div>
            </TableCell>
            <TableCell>
              <div class="flex items-center gap-2">
                <TooltipProvider v-if="record.comment">
                  <Tooltip>
                    <TooltipTrigger as-child>
                      <MessageSquare
                        class="h-4 w-4 text-muted-foreground cursor-help"
                      />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p class="max-w-xs">{{ record.comment }}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <span class="max-w-[200px] truncate">{{ record.name }}</span>
              </div>
            </TableCell>
            <TableCell>
              <span class="max-w-[250px] truncate block">{{
                record.value
              }}</span>
            </TableCell>
            <TableCell v-if="isCloudflare">
              <div class="flex items-center gap-2">
                <Cloud v-if="record.proxied" class="h-5 w-5 text-orange-500" />
                <CloudOff v-else class="h-5 w-5 text-muted-foreground" />
                <span class="text-sm">
                  {{
                    record.proxied
                      ? t("operations.dns.records.proxied")
                      : t("operations.dns.records.dnsOnly")
                  }}
                </span>
              </div>
            </TableCell>
            <TableCell>{{ formatTtl(record) }}</TableCell>
            <TableCell class="text-right">
              <div class="flex items-center justify-end gap-1">
                <DnsRecordModal
                  :domain="domain"
                  :record="record"
                  :available-record-types="
                    recordTypes.filter((t) => t !== 'NS')
                  "
                  :is-cloudflare="isCloudflare"
                  @updated="fetchDomainData"
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    :aria-label="
                      t('operations.dns.record.editButtonAria', {
                        type: record.type,
                        name: record.name,
                      })
                    "
                  >
                    <Icon name="lucide:pencil" class="h-4 w-4" />
                  </Button>
                </DnsRecordModal>
                <Button
                  variant="ghost"
                  size="sm"
                  class="text-destructive hover:text-destructive"
                  :aria-label="
                    t('operations.dns.record.deleteButtonAria', {
                      type: record.type,
                      name: record.name,
                    })
                  "
                  @click="deleteRecord(record)"
                >
                  <Icon name="lucide:trash-2" class="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredRecords.length === 0">
            <TableCell :colspan="isCloudflare ? 7 : 6" class="p-0">
              <SharedEmptyState
                icon="lucide:globe"
                :title="t('operations.dns.records.emptyTitle')"
                :description="t('operations.dns.records.emptyDescription')"
              />
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>

      <!-- Nameservers Section -->
      <div
        v-if="nsRecords.length > 0 || domain.nameservers?.length"
        class="mt-8"
      >
        <div class="mb-4">
          <h3 class="text-lg font-semibold">
            {{
              isCloudflare
                ? t("operations.dns.records.cloudflareNameservers")
                : t("operations.dns.records.nameservers")
            }}
          </h3>
          <p class="text-sm text-muted-foreground">
            {{
              isCloudflare
                ? t("operations.dns.records.cloudflareNameserversDescription")
                : t("operations.dns.records.nameserversDescription")
            }}
          </p>
        </div>
        <Table>
          <TableHeader>
            <TableRow class="bg-muted/40 hover:bg-muted/40">
              <TableHead class="w-[100px]">{{
                t("operations.dns.records.type")
              }}</TableHead>
              <TableHead>{{
                t("operations.dns.records.nameserverValue")
              }}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <template v-if="nsRecords.length > 0">
              <TableRow
                v-for="record in nsRecords"
                :key="record.id"
                class="hover:bg-muted/20"
              >
                <TableCell class="font-medium">NS</TableCell>
                <TableCell>{{ record.value }}</TableCell>
              </TableRow>
            </template>
            <template v-else-if="domain.nameservers?.length">
              <TableRow
                v-for="(ns, index) in domain.nameservers"
                :key="index"
                class="hover:bg-muted/20"
              >
                <TableCell class="font-medium">NS</TableCell>
                <TableCell>{{ ns }}</TableCell>
              </TableRow>
            </template>
          </TableBody>
        </Table>
      </div>
    </template>
  </div>
</template>
