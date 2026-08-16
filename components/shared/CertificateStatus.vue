<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import type { CertificateStatusResult } from "~/types";

interface Props {
  check: () => Promise<{ data: CertificateStatusResult }>;
  retry?: () => Promise<unknown>;
  enabled?: boolean;
  compact?: boolean;
  autoCheck?: boolean;
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

const statusMeta = computed(() => {
  if (isRetrying.value) {
    return {
      label: "Retry queued",
      icon: "lucide:clock-3",
      classes:
        "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-400",
    };
  }
  if (isChecking.value && !result.value) {
    return {
      label: "Checking",
      icon: "lucide:loader-2",
      classes: "border-border bg-muted/50 text-muted-foreground",
    };
  }

  switch (result.value?.status) {
    case "valid":
      return {
        label: "Valid",
        icon: "lucide:shield-check",
        classes:
          "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
      };
    case "expired":
      return {
        label: "Expired",
        icon: "lucide:shield-x",
        classes: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "invalid":
      return {
        label: "Invalid",
        icon: "lucide:shield-alert",
        classes: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "not_issued":
      return {
        label: "Not issued",
        icon: "lucide:shield-alert",
        classes: "border-destructive/40 bg-destructive/10 text-destructive",
      };
    case "unreachable":
      return {
        label: "Unreachable",
        icon: "lucide:wifi-off",
        classes:
          "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
      };
    default:
      return {
        label: "Verify",
        icon: "lucide:shield-question",
        classes: "border-border bg-muted/50 text-muted-foreground",
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
    return `Expires ${date} (${result.value.days_remaining} days)`;
  }
  return `Expires ${date}`;
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

  <div v-else-if="compact" class="flex items-center gap-1.5">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors disabled:cursor-wait disabled:opacity-70"
      :class="statusMeta.classes"
      :disabled="isChecking"
      :title="result?.message || 'Check the certificate served on port 443'"
      @click="checkCertificate"
    >
      <Icon
        :name="statusMeta.icon"
        :class="['h-3 w-3', isChecking && 'animate-spin']"
      />
      {{ statusMeta.label }}
    </button>
    <Button
      v-if="retry && result && !result.valid"
      type="button"
      variant="ghost"
      size="icon"
      class="h-7 w-7"
      :disabled="isRetrying"
      title="Retry certificate provisioning"
      @click="retryCertificate"
    >
      <Icon
        name="lucide:rotate-cw"
        :class="['h-3.5 w-3.5', isRetrying && 'animate-spin']"
      />
    </Button>
  </div>

  <div v-else class="rounded-lg border bg-muted/20 p-4">
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span
            class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium"
            :class="statusMeta.classes"
          >
            <Icon
              :name="statusMeta.icon"
              :class="['h-3.5 w-3.5', isChecking && 'animate-spin']"
            />
            {{ statusMeta.label }}
          </span>
          <span v-if="result?.issuer" class="text-xs text-muted-foreground">
            {{ result.issuer }}
          </span>
        </div>
        <p class="mt-2 text-sm text-muted-foreground">
          {{
            result?.message ||
            "Checking the certificate served to public clients…"
          }}
        </p>
        <p v-if="expiryLabel" class="mt-1 text-xs text-muted-foreground">
          {{ expiryLabel }}
        </p>
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
          Verify
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
  </div>
</template>
