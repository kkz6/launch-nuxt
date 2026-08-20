<script setup lang="ts">
import { toast } from "vue-sonner";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  PinInput,
  PinInputGroup,
  PinInputSeparator,
  PinInputSlot,
} from "~/components/ui/pin-input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { PersonalAccessToken, PersonalAccessTokenCreated } from "~/types";

const { user } = useAuth();
const { locale, t } = useI18n();
const relativeTime = computed(
  () => new Intl.RelativeTimeFormat(locale.value, { numeric: "always" }),
);

const tokens = ref<PersonalAccessToken[]>([]);
const isLoading = ref(false);
const isCreateDialogOpen = ref(false);
const tokenName = ref("");
const twoFactorCode = ref<number[]>([]);
const twoFactorError = ref("");
const createdToken = ref<PersonalAccessTokenCreated | null>(null);
const copied = ref(false);
const confirmationDialog = ref<InstanceType<
  typeof import("~/components/shared/ConfirmationDialog.vue").default
> | null>(null);

const hasTwoFactor = computed(() => user.value?.two_factor_enabled);

const fetchTokens = async () => {
  isLoading.value = true;
  try {
    const response = await $api<{ data: PersonalAccessToken[] }>(
      "/user/tokens",
    );
    tokens.value = response.data || [];
  } catch {
    toast.error(t("settings.tokens.loadFailed"));
  } finally {
    isLoading.value = false;
  }
};

const createToken = async (codeValue?: string) => {
  if (!tokenName.value.trim()) {
    toast.error(t("settings.tokens.nameRequired"));
    return;
  }

  const code = codeValue ?? twoFactorCode.value.join("");

  if (hasTwoFactor.value && code.length !== 6) {
    return;
  }

  isLoading.value = true;
  twoFactorError.value = "";
  try {
    const body: Record<string, string> = { name: tokenName.value };
    if (hasTwoFactor.value) {
      body.code = code;
    }

    const response = await $api<{ data: PersonalAccessTokenCreated }>(
      "/user/tokens",
      {
        method: "POST",
        body,
      },
    );
    createdToken.value = response.data;
    tokenName.value = "";
    twoFactorCode.value = [];
    isCreateDialogOpen.value = false;
    await fetchTokens();
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as {
        data?: { errors?: Record<string, string[]> };
      };
      if (fetchError.data?.errors?.code) {
        twoFactorError.value = fetchError.data.errors.code[0];
        return;
      }
    }
    toast.error(t("settings.tokens.createFailed"));
  } finally {
    isLoading.value = false;
  }
};

const copyToken = async () => {
  if (!createdToken.value) return;
  try {
    await navigator.clipboard.writeText(createdToken.value.plain_text_token);
    copied.value = true;
    toast.success(t("settings.tokens.copied"));
    setTimeout(() => {
      copied.value = false;
    }, 2000);
  } catch {
    toast.error(t("settings.tokens.copyFailed"));
  }
};

const closeCreatedDialog = () => {
  createdToken.value = null;
  copied.value = false;
};

const revokeToken = async (id: string, name: string) => {
  if (!confirmationDialog.value) return;

  const result = await confirmationDialog.value.show({
    title: t("settings.tokens.revokeTitle"),
    description: t("settings.tokens.revokeDescription", { name }),
    confirmText: t("settings.tokens.revoke"),
    cancelText: t("settings.tokens.cancel"),
    destructive: true,
  });

  if (!result.ok) return;

  try {
    await $api(`/user/tokens/${id}`, { method: "DELETE" });
    toast.success(t("settings.tokens.revoked"));
    await fetchTokens();
  } catch {
    toast.error(t("settings.tokens.revokeFailed"));
  }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return t("settings.tokens.never");
  const date = new Date(dateStr);
  return date.toLocaleDateString(locale.value, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatLastUsed = (dateStr: string | null) => {
  if (!dateStr) return t("settings.tokens.neverUsed");
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return t("settings.tokens.justNow");
  if (diffMins < 60) return relativeTime.value.format(-diffMins, "minute");
  if (diffHours < 24) return relativeTime.value.format(-diffHours, "hour");
  if (diffDays < 7) return relativeTime.value.format(-diffDays, "day");
  return formatDate(dateStr);
};

onMounted(fetchTokens);
</script>

<template>
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <!-- Token Created Dialog -->
    <Dialog :open="!!createdToken" @update:open="closeCreatedDialog">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{{ t("settings.tokens.createdTitle") }}</DialogTitle>
          <DialogDescription>
            {{ t("settings.tokens.createdDescription") }}
          </DialogDescription>
        </DialogHeader>
        <div v-if="createdToken" class="space-y-3">
          <div class="flex items-center gap-2">
            <code
              class="min-w-0 flex-1 break-all rounded-md border bg-muted px-3 py-2 text-sm"
            >
              {{ createdToken.plain_text_token }}
            </code>
            <Button variant="outline" size="sm" @click="copyToken">
              <Icon
                :name="copied ? 'lucide:check' : 'lucide:copy'"
                class="block size-4"
              />
            </Button>
          </div>
          <div
            class="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200"
          >
            {{ t("settings.tokens.storeWarning") }}
          </div>
        </div>
        <DialogFooter>
          <Button @click="closeCreatedDialog">
            {{ t("settings.tokens.done") }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Create Token -->
    <div class="flex items-center justify-between">
      <div class="text-sm text-muted-foreground">
        {{
          tokens.length === 0
            ? t("settings.tokens.noneCreated")
            : t("settings.tokens.count", {
                count: tokens.length,
                unit: t(
                  tokens.length === 1
                    ? "settings.tokens.token"
                    : "settings.tokens.tokens",
                ),
              })
        }}
      </div>
      <Dialog
        v-model:open="isCreateDialogOpen"
        @update:open="
          (open: boolean) => {
            if (!open) {
              twoFactorCode = [];
              twoFactorError = '';
            }
          }
        "
      >
        <DialogTrigger as-child>
          <Button size="sm" :disabled="isLoading">
            <Icon name="lucide:plus" class="mr-1 block size-4" />
            {{ t("settings.tokens.create") }}
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{{ t("settings.tokens.createTitle") }}</DialogTitle>
            <DialogDescription>
              {{ t("settings.tokens.createDescription") }}
            </DialogDescription>
          </DialogHeader>
          <form class="space-y-4" @submit.prevent="createToken()">
            <div class="space-y-2">
              <Label for="token-name">{{ t("settings.tokens.name") }}</Label>
              <Input
                id="token-name"
                v-model="tokenName"
                :placeholder="t('settings.tokens.namePlaceholder')"
                autofocus
              />
            </div>
            <div v-if="hasTwoFactor" class="space-y-2">
              <Label>{{ t("settings.tokens.authenticationCode") }}</Label>
              <div class="flex justify-center">
                <PinInput
                  v-model="twoFactorCode"
                  type="number"
                  :length="6"
                  @complete="(digits: number[]) => createToken(digits.join(''))"
                >
                  <PinInputGroup>
                    <PinInputSlot
                      v-for="(_, index) in 3"
                      :key="index"
                      :index="index"
                    />
                  </PinInputGroup>
                  <PinInputSeparator />
                  <PinInputGroup>
                    <PinInputSlot
                      v-for="(_, index) in 3"
                      :key="index + 3"
                      :index="index + 3"
                    />
                  </PinInputGroup>
                </PinInput>
              </div>
              <p
                v-if="twoFactorError"
                class="text-center text-sm text-destructive"
              >
                {{ twoFactorError }}
              </p>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                @click="isCreateDialogOpen = false"
              >
                {{ t("settings.tokens.cancel") }}
              </Button>
              <Button type="submit" :disabled="isLoading || !tokenName.trim()">
                <Icon
                  v-if="isLoading"
                  name="lucide:loader-2"
                  class="mr-2 block size-4 animate-spin"
                />
                {{ t("settings.tokens.create") }}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>

    <!-- Token List -->
    <div
      v-if="isLoading && tokens.length === 0"
      class="py-4 text-center text-sm text-muted-foreground"
    >
      {{ t("settings.tokens.loading") }}
    </div>

    <div v-else-if="tokens.length > 0" class="space-y-3">
      <div
        v-for="token in tokens"
        :key="token.id"
        class="flex items-center justify-between rounded-lg border p-3"
      >
        <div class="flex items-center gap-3">
          <Icon name="lucide:key" class="block size-4 text-muted-foreground" />
          <div>
            <div class="text-sm font-medium">{{ token.name }}</div>
            <div class="text-xs text-muted-foreground">
              {{
                t("settings.tokens.created", {
                  date: formatDate(token.created_at),
                })
              }}
              <template v-if="token.last_used_at">
                &middot;
                {{
                  t("settings.tokens.lastUsed", {
                    time: formatLastUsed(token.last_used_at),
                  })
                }}
              </template>
              <template v-else>
                &middot; {{ t("settings.tokens.neverUsed") }}
              </template>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <Badge v-if="token.expires_at" variant="outline" class="text-xs">
            {{
              t("settings.tokens.expires", {
                date: formatDate(token.expires_at),
              })
            }}
          </Badge>
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive hover:text-destructive"
            @click="revokeToken(token.id, token.name)"
          >
            {{ t("settings.tokens.revoke") }}
          </Button>
        </div>
      </div>
    </div>

    <div v-else class="py-4 text-center text-muted-foreground">
      <Icon name="lucide:key" class="mx-auto mb-2 block size-8 opacity-50" />
      <p class="text-sm">{{ t("settings.tokens.emptyAction") }}</p>
    </div>
  </div>
</template>
