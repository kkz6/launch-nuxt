<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Label } from "~/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "~/components/ui/collapsible";
import { serverService } from "~/services/serverService";

interface Props {
  serverId: string;
  provisionCommand: string | null;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  connected: [];
}>();

const open = defineModel<boolean>("open", { default: false });

const isTryingConnection = ref(false);

// Try the SSH connection from inside the dialog so the entire
// "copy the script → run it on your box → confirm reachability"
// loop lives in one place. The card outside used to carry a parallel
// Try Connection button, which split the flow: users would dismiss
// the script dialog, click Try on the card, fail, reopen the dialog,
// copy again. One workflow surface is cleaner.
const handleTryConnection = async () => {
  isTryingConnection.value = true;
  try {
    await serverService.tryConnection(props.serverId);
    toast.success(t("server.provisionCommand.connected"));
    emit("connected");
    open.value = false;
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    const raw = (err.data?.message || "").trim();
    // Backend errors here are long — SSH handshake failures concatenate
    // host:port, handshake stage, attempted auth methods, and a hint
    // into one string (~300+ chars). Putting that into toast.error's
    // single title slot stretched the toast to fill the screen. Split
    // into a short bold title and the verbose detail in description,
    // where Sonner renders it as secondary text with proper wrapping.
    toast.error(t("server.provisionCommand.connectionFailed"), {
      description: raw || t("server.provisionCommand.connectionFailedHelp"),
      duration: 10000,
    });
  } finally {
    isTryingConnection.value = false;
  }
};

const isDev = import.meta.dev;

const provisionScript = ref("");
const provisionScriptLoading = ref(false);
const provisionScriptError = ref("");
const showScriptContent = ref(false);
const commandCopied = ref(false);
const scriptCopied = ref(false);

// Copy text to clipboard
const copyToClipboard = async (text: string, type: "command" | "script") => {
  try {
    await navigator.clipboard.writeText(text);
    if (type === "command") {
      commandCopied.value = true;
      setTimeout(() => {
        commandCopied.value = false;
      }, 2000);
    } else {
      scriptCopied.value = true;
      setTimeout(() => {
        scriptCopied.value = false;
      }, 2000);
    }
    toast.success(t("server.provisionCommand.copied"));
  } catch {
    toast.error(t("server.provisionCommand.copyFailed"));
  }
};

// Fetch the provision script content
const fetchProvisionScript = async () => {
  // Don't refetch if already have script (unless there's an error)
  if (provisionScript.value && !provisionScriptError.value) return;

  provisionScriptLoading.value = true;
  provisionScriptError.value = "";
  provisionScript.value = "";
  try {
    const response = await $api<{ success: boolean; data: { script: string } }>(
      `/servers/${props.serverId}/provision-script-content`,
    );
    provisionScript.value = response.data?.script || "";
    if (!provisionScript.value) {
      provisionScriptError.value = t("server.provisionCommand.scriptEmpty");
    }
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } };
    provisionScriptError.value =
      err.data?.message || t("server.provisionCommand.scriptFailed");
    toast.error(provisionScriptError.value);
  } finally {
    provisionScriptLoading.value = false;
  }
};

// Reset state when serverId changes (different server selected)
watch(
  () => props.serverId,
  () => {
    provisionScript.value = "";
    provisionScriptError.value = "";
    provisionScriptLoading.value = false;
    showScriptContent.value = false;
  },
);

// Fetch script when dialog opens
watch(open, (isOpen) => {
  if (isOpen) {
    provisionScriptError.value = "";
    provisionScript.value = "";
    fetchProvisionScript();
  }
});

// Also fetch when collapsible is opened (if not already loaded)
watch(showScriptContent, (isOpen) => {
  if (isOpen && !provisionScript.value && !provisionScriptLoading.value) {
    fetchProvisionScript();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogContent class="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Icon name="lucide:terminal" class="h-5 w-5" />
          {{ t("server.provisionCommand.title") }}
        </DialogTitle>
        <DialogDescription>
          {{ t("server.provisionCommand.description") }}
        </DialogDescription>
      </DialogHeader>

      <div class="space-y-4 overflow-x-hidden">
        <!-- Quick Command -->
        <div v-if="provisionCommand" class="space-y-2">
          <Label>{{ t("server.provisionCommand.quickCommand") }}</Label>
          <div class="flex items-center gap-2">
            <div
              class="flex-1 overflow-hidden rounded-md border bg-muted/50 p-3"
            >
              <code class="break-all text-sm">{{ provisionCommand }}</code>
            </div>
            <Button
              variant="outline"
              size="icon"
              @click="copyToClipboard(provisionCommand, 'command')"
            >
              <Icon
                :name="commandCopied ? 'lucide:check' : 'lucide:copy'"
                class="h-4 w-4"
              />
            </Button>
          </div>
          <p class="text-xs text-muted-foreground">
            {{ t("server.provisionCommand.quickCommandHelp") }}
          </p>
        </div>

        <!-- Collapsible Script Content (only visible in development) -->
        <Collapsible
          v-if="isDev"
          v-model:open="showScriptContent"
          class="space-y-2"
        >
          <div class="flex items-center justify-between">
            <Label>{{ t("server.provisionCommand.scriptContent") }}</Label>
            <CollapsibleTrigger as-child>
              <Button variant="ghost" size="sm">
                <Icon
                  :name="
                    showScriptContent
                      ? 'lucide:chevron-up'
                      : 'lucide:chevron-down'
                  "
                  class="mr-1 h-4 w-4"
                />
                {{
                  showScriptContent
                    ? t("server.provisionCommand.hideScript")
                    : t("server.provisionCommand.showScript")
                }}
              </Button>
            </CollapsibleTrigger>
          </div>

          <CollapsibleContent>
            <div class="space-y-2">
              <div
                v-if="provisionScriptLoading"
                class="flex items-center justify-center p-4"
              >
                <Icon name="lucide:loader-2" class="h-5 w-5 animate-spin" />
                <span class="ml-2 text-sm text-muted-foreground">{{
                  t("server.provisionCommand.loadingScript")
                }}</span>
              </div>
              <div
                v-else-if="provisionScriptError"
                class="rounded-md border border-destructive/50 bg-destructive/10 p-4"
              >
                <p class="text-sm text-destructive">
                  {{ provisionScriptError }}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  class="mt-2"
                  @click="fetchProvisionScript"
                >
                  {{ t("server.common.retry") }}
                </Button>
              </div>
              <div v-else-if="provisionScript" class="relative">
                <div
                  class="max-h-80 overflow-auto rounded-md border bg-muted/50"
                >
                  <pre
                    class="p-4 text-xs whitespace-pre-wrap break-all"
                  ><code>{{ provisionScript }}</code></pre>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  class="absolute right-2 top-2"
                  @click="copyToClipboard(provisionScript, 'script')"
                >
                  <Icon
                    :name="scriptCopied ? 'lucide:check' : 'lucide:copy'"
                    class="mr-1 h-3 w-3"
                  />
                  {{
                    scriptCopied
                      ? t("server.provisionCommand.copiedLabel")
                      : t("server.provisionCommand.copy")
                  }}
                </Button>
              </div>
              <div v-else class="flex items-center justify-center p-4">
                <Button
                  variant="outline"
                  size="sm"
                  @click="fetchProvisionScript"
                >
                  <Icon name="lucide:download" class="mr-2 h-4 w-4" />
                  {{ t("server.provisionCommand.loadScript") }}
                </Button>
              </div>
              <p class="text-xs text-muted-foreground">
                {{ t("server.provisionCommand.localHelp") }}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        <!-- Status indicator -->
        <div
          class="flex items-start gap-3 rounded-lg bg-amber-50 p-4 dark:bg-amber-950/50"
        >
          <Icon
            name="lucide:alert-triangle"
            class="mt-0.5 h-5 w-5 text-amber-600 dark:text-amber-400"
          />
          <div class="space-y-1">
            <p class="text-sm font-medium text-amber-800 dark:text-amber-200">
              {{ t("server.provisionCommand.pending") }}
            </p>
            <p class="text-sm text-amber-700 dark:text-amber-300">
              {{ t("server.provisionCommand.pendingPrefix") }}
              <strong>{{ t("server.provisionCommand.tryConnection") }}</strong>
              {{ t("server.provisionCommand.pendingSuffix") }}
            </p>
          </div>
        </div>
      </div>

      <DialogFooter class="gap-2 sm:gap-2">
        <Button
          variant="outline"
          :disabled="isTryingConnection"
          @click="open = false"
        >
          {{ t("server.common.close") }}
        </Button>
        <!--
          Picks up the same amber palette as the warning banner directly
          above so the dialog reads as one coherent "this is the pending
          action" surface. Darker than the secondary variant (amber-100
          fill vs secondary gray) with a visible border so it's
          unmistakably the primary CTA next to Close, and so it carries
          the same bordered look as the Provision button that opened
          this dialog in the first place.
        -->
        <Button
          :disabled="isTryingConnection"
          class="border border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200 dark:border-amber-700/60 dark:bg-amber-900/50 dark:text-amber-100 dark:hover:bg-amber-800/60"
          @click="handleTryConnection"
        >
          <Icon
            :name="isTryingConnection ? 'lucide:loader-2' : 'lucide:plug-zap'"
            :class="['mr-2 h-4 w-4', isTryingConnection && 'animate-spin']"
          />
          {{ t("server.provisionCommand.tryConnection") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
