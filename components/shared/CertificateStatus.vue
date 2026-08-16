<script setup lang="ts">
import { toast } from "vue-sonner";
import { Badge, type BadgeVariants } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "~/components/ui/popover";
import type { CertificateStatusResult } from "~/types";

interface Props {
  check: () => Promise<{ data: CertificateStatusResult }>;
  retry?: () => Promise<unknown>;
  enabled?: boolean;
  compact?: boolean;
  autoCheck?: boolean;
}

type BadgeVariant = NonNullable<BadgeVariants["variant"]>;

interface StatusMeta {
  label: string;
  icon: string;
  variant: BadgeVariant;
  iconClasses: string;
  surfaceClasses: string;
}

const props = withDefaults(defineProps<Props>(), {
  retry: undefined,
  enabled: true,
  compact: false,
  autoCheck: true,
});

const result = ref<CertificateStatusResult | null>(null);
const isChecking = ref(false);
const isRetrying = ref(false);
let retryCheckTimer: ReturnType<typeof setTimeout> | null = null;

const statusMeta = computed<StatusMeta>(() => {
  if (isRetrying.value) {
    return {
      label: "Retry queued",
      icon: "lucide:clock-3",
      variant: "blue",
      iconClasses: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
      surfaceClasses: "border-blue-500/20 bg-blue-500/5",
    };
  }
  if (isChecking.value && !result.value) {
    return {
      label: "Checking",
      icon: "lucide:loader-2",
      variant: "blank",
      iconClasses: "bg-muted text-muted-foreground",
      surfaceClasses: "bg-muted/30",
    };
  }

  switch (result.value?.status) {
    case "valid":
      return {
        label: "Valid",
        icon: "lucide:shield-check",
        variant: "green",
        iconClasses: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        surfaceClasses: "border-emerald-500/20 bg-emerald-500/5",
      };
    case "expired":
      return {
        label: "Expired",
        icon: "lucide:shield-x",
        variant: "red",
        iconClasses: "bg-destructive/10 text-destructive",
        surfaceClasses: "border-destructive/20 bg-destructive/5",
      };
    case "invalid":
      return {
        label: "Invalid",
        icon: "lucide:shield-alert",
        variant: "red",
        iconClasses: "bg-destructive/10 text-destructive",
        surfaceClasses: "border-destructive/20 bg-destructive/5",
      };
    case "not_issued":
      return {
        label: "Not issued",
        icon: "lucide:shield-alert",
        variant: "yellow",
        iconClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        surfaceClasses: "border-amber-500/20 bg-amber-500/5",
      };
    case "unreachable":
      return {
        label: "Unreachable",
        icon: "lucide:wifi-off",
        variant: "yellow",
        iconClasses: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        surfaceClasses: "border-amber-500/20 bg-amber-500/5",
      };
    default:
      return {
        label: "Verify",
        icon: "lucide:shield-question",
        variant: "blank",
        iconClasses: "bg-muted text-muted-foreground",
        surfaceClasses: "bg-muted/30",
      };
  }
});

const diagnosis = computed(() => {
  if (isRetrying.value) {
    return {
      title: "Provisioning retry queued",
      guidance: "The proxy configuration is being reapplied. Verification will run again shortly.",
    };
  }
  if (isChecking.value && !result.value) {
    return {
      title: "Checking the public endpoint",
      guidance: "Resolving DNS and inspecting the certificate served on port 443.",
    };
  }

  const message = result.value?.message.toLowerCase() || "";
  switch (result.value?.status) {
    case "valid":
      return {
        title: "Certificate is active",
        guidance: "Public clients are receiving a trusted certificate for this hostname.",
      };
    case "expired":
      return {
        title: "Certificate has expired",
        guidance: "Retry automatic issuance or replace the certificate before serving traffic.",
      };
    case "invalid":
      if (message.includes("not presenting a certificate for") || message.includes("hostname")) {
        return {
          title: "Hostname does not match",
          guidance: "The proxy is serving a certificate for another hostname. Confirm DNS points to this server, then retry issuance.",
        };
      }
      if (message.includes("not trusted")) {
        return {
          title: "Certificate is not trusted",
          guidance: "Replace the custom certificate or retry automatic issuance after DNS is correct.",
        };
      }
      if (message.includes("not valid until")) {
        return {
          title: "Certificate is not active yet",
          guidance: "Check the server clock or install a certificate whose validity period has started.",
        };
      }
      return {
        title: "Certificate validation failed",
        guidance: "Check DNS, the configured hostname, and the certificate selected by the proxy before retrying.",
      };
    case "not_issued":
      if (message.includes("dns lookup failed")) {
        return {
          title: "DNS is not resolving",
          guidance: "Create or correct the public A or AAAA record, wait for propagation, then retry issuance.",
        };
      }
      return {
        title: "No certificate is being served",
        guidance: "Confirm the domain reaches this server on port 443, then retry certificate issuance.",
      };
    case "unreachable":
      return {
        title: "HTTPS endpoint is unreachable",
        guidance: "Check public DNS and ensure ports 80 and 443 reach the proxy before retrying.",
      };
    default:
      return {
        title: "Certificate not verified",
        guidance: "Run verification to inspect the certificate public clients receive.",
      };
  }
});

const expiryLabel = computed(() => {
  if (!result.value?.expires_at) return "";
  const date = new Date(result.value.expires_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  if (result.value.valid && result.value.days_remaining != null) {
    return `${date} · ${result.value.days_remaining} days remaining`;
  }
  return date;
});

const checkedLabel = computed(() => {
  if (!result.value?.checked_at) return "";
  return new Date(result.value.checked_at).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
});

const checkCertificate = async () => {
  if (!props.enabled || isChecking.value) return;
  isChecking.value = true;
  try {
    const response = await props.check();
    result.value = response.data;
    isRetrying.value = false;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    result.value = {
      host: "",
      status: "unreachable",
      valid: false,
      message: err.data?.message || "Certificate verification failed.",
      checked_at: new Date().toISOString(),
    };
  } finally {
    isChecking.value = false;
    isRetrying.value = false;
  }
};

const retryCertificate = async () => {
  if (!props.retry || isRetrying.value) return;
  isRetrying.value = true;
  try {
    await props.retry();
    toast.success("Certificate retry queued", {
      description: "The proxy configuration is being reapplied.",
    });
    if (retryCheckTimer) clearTimeout(retryCheckTimer);
    retryCheckTimer = setTimeout(() => void checkCertificate(), 12_000);
  } catch (error: unknown) {
    isRetrying.value = false;
    const err = error as { data?: { message?: string } };
    toast.error(
      err.data?.message || "Failed to retry certificate provisioning",
    );
  }
};

watch(
  () => props.enabled,
  (enabled) => {
    if (enabled && props.autoCheck) void checkCertificate();
    if (!enabled) result.value = null;
  },
);

onMounted(() => {
  if (props.enabled && props.autoCheck) void checkCertificate();
});

onBeforeUnmount(() => {
  if (retryCheckTimer) clearTimeout(retryCheckTimer);
});
</script>

<template>
  <span v-if="!enabled" class="text-xs text-muted-foreground">—</span>

  <Popover v-else-if="compact">
    <PopoverTrigger as-child>
      <button
        type="button"
        class="group flex max-w-full items-center gap-2 rounded-md py-1 text-left transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-70"
        :disabled="isChecking"
      >
        <Badge :variant="statusMeta.variant" class="shrink-0 gap-1">
          <Icon
            :name="statusMeta.icon"
            :class="['h-3 w-3', isChecking && 'animate-spin']"
          />
          {{ statusMeta.label }}
        </Badge>
        <span class="truncate text-xs text-muted-foreground group-hover:text-foreground">
          {{ diagnosis.title }}
        </span>
        <Icon name="lucide:info" class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" class="w-80 overflow-hidden p-0">
      <div :class="['border-b px-4 py-3', statusMeta.surfaceClasses]">
        <div class="flex items-start gap-3">
          <div :class="['flex h-9 w-9 shrink-0 items-center justify-center rounded-md', statusMeta.iconClasses]">
            <Icon
              :name="statusMeta.icon"
              :class="['h-4 w-4', isChecking && 'animate-spin']"
            />
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center justify-between gap-2">
              <p class="text-sm font-medium text-foreground">{{ diagnosis.title }}</p>
              <Badge :variant="statusMeta.variant">{{ statusMeta.label }}</Badge>
            </div>
            <p v-if="result?.host" class="mt-0.5 truncate font-mono text-xs text-muted-foreground">
              {{ result.host }}
            </p>
          </div>
        </div>
      </div>

      <div class="space-y-3 px-4 py-3">
        <p class="text-sm leading-5 text-foreground">
          {{ result?.message || "Checking the certificate served to public clients…" }}
        </p>
        <div class="rounded-md bg-muted/60 px-3 py-2.5">
          <p class="text-xs font-medium text-foreground">What to check</p>
          <p class="mt-1 text-xs leading-5 text-muted-foreground">
            {{ diagnosis.guidance }}
          </p>
        </div>

        <dl v-if="result" class="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
          <dt v-if="result.issuer" class="text-muted-foreground">Issuer</dt>
          <dd v-if="result.issuer" class="truncate text-right font-medium">{{ result.issuer }}</dd>
          <dt v-if="expiryLabel" class="text-muted-foreground">Expires</dt>
          <dd v-if="expiryLabel" class="text-right font-medium tabular-nums">{{ expiryLabel }}</dd>
          <dt v-if="result.resolved_ip" class="text-muted-foreground">Resolved IP</dt>
          <dd v-if="result.resolved_ip" class="text-right font-mono">{{ result.resolved_ip }}</dd>
          <dt v-if="checkedLabel" class="text-muted-foreground">Checked</dt>
          <dd v-if="checkedLabel" class="text-right tabular-nums">{{ checkedLabel }}</dd>
        </dl>
      </div>

      <div class="flex items-center justify-end gap-2 border-t bg-muted/20 px-4 py-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="isChecking"
          @click="checkCertificate"
        >
          <Icon
            name="lucide:refresh-cw"
            :class="['mr-1.5 h-3.5 w-3.5', isChecking && 'animate-spin']"
          />
          Verify again
        </Button>
        <Button
          v-if="retry && result && !result.valid"
          type="button"
          size="sm"
          :disabled="isRetrying"
          @click="retryCertificate"
        >
          <Icon
            name="lucide:rotate-cw"
            :class="['mr-1.5 h-3.5 w-3.5', isRetrying && 'animate-spin']"
          />
          Retry
        </Button>
      </div>
    </PopoverContent>
  </Popover>

  <section v-else class="overflow-hidden rounded-lg border bg-card">
    <div class="flex flex-wrap items-start justify-between gap-4 p-4">
      <div class="flex min-w-0 items-start gap-3">
        <div :class="['flex h-10 w-10 shrink-0 items-center justify-center rounded-lg', statusMeta.iconClasses]">
          <Icon
            :name="statusMeta.icon"
            :class="['h-5 w-5', isChecking && 'animate-spin']"
          />
        </div>
        <div class="min-w-0">
          <div class="flex flex-wrap items-center gap-2">
            <p class="text-sm font-medium text-foreground">Certificate status</p>
            <Badge :variant="statusMeta.variant">{{ statusMeta.label }}</Badge>
          </div>
          <p class="mt-1 text-sm font-medium text-foreground">{{ diagnosis.title }}</p>
          <p v-if="result?.host" class="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {{ result.host }}
          </p>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          :disabled="isChecking"
          @click="checkCertificate"
        >
          <Icon
            name="lucide:refresh-cw"
            :class="['mr-2 h-3.5 w-3.5', isChecking && 'animate-spin']"
          />
          Verify again
        </Button>
        <Button
          v-if="retry && result && !result.valid"
          type="button"
          size="sm"
          :disabled="isRetrying"
          @click="retryCertificate"
        >
          <Icon
            name="lucide:rotate-cw"
            :class="['mr-2 h-3.5 w-3.5', isRetrying && 'animate-spin']"
          />
          Retry certificate
        </Button>
      </div>
    </div>

    <div :class="['border-t px-4 py-3', statusMeta.surfaceClasses]">
      <p class="text-sm leading-6 text-foreground">
        {{ result?.message || "Checking the certificate served to public clients…" }}
      </p>
      <div class="mt-2 flex items-start gap-2 text-xs leading-5 text-muted-foreground">
        <Icon name="lucide:arrow-right" class="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{{ diagnosis.guidance }}</span>
      </div>

      <dl v-if="result" class="mt-3 grid gap-3 border-t border-border/60 pt-3 sm:grid-cols-3">
        <div v-if="result.issuer">
          <dt class="text-xs text-muted-foreground">Issuer</dt>
          <dd class="mt-0.5 truncate text-sm font-medium">{{ result.issuer }}</dd>
        </div>
        <div v-if="expiryLabel">
          <dt class="text-xs text-muted-foreground">Expires</dt>
          <dd class="mt-0.5 text-sm font-medium tabular-nums">{{ expiryLabel }}</dd>
        </div>
        <div v-if="result.resolved_ip">
          <dt class="text-xs text-muted-foreground">Resolved IP</dt>
          <dd class="mt-0.5 font-mono text-sm">{{ result.resolved_ip }}</dd>
        </div>
      </dl>
    </div>
  </section>
</template>
