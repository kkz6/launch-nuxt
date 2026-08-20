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
} from "~/components/ui/dialog";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  dockerService,
  type DockerRegistryCredential,
} from "~/services/dockerService";

// Saved-credential create / edit dialog. Same component handles both
// modes — pass `credential` to open in edit mode. The password field
// is special in edit mode: empty input = leave the stored value
// alone; only a non-empty input rotates the password (the backend
// rejects empty-string explicitly so we don't accidentally clear it).
interface Props {
  credential?: DockerRegistryCredential;
}
const props = defineProps<Props>();
const emit = defineEmits<{ created: []; updated: [] }>();
const { t } = useI18n();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);

const name = ref(props.credential?.name ?? "");
const registryUrl = ref(props.credential?.registry_url ?? "");
const username = ref(props.credential?.username ?? "");
const password = ref("");
const errors = ref<Record<string, string>>({});

const resetForm = () => {
  name.value = props.credential?.name ?? "";
  registryUrl.value = props.credential?.registry_url ?? "";
  username.value = props.credential?.username ?? "";
  password.value = "";
  errors.value = {};
};

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});

const validate = () => {
  errors.value = {};
  if (!name.value.trim())
    errors.value.name = t("settings.connectionDialogs.validation.nameRequired");
  if (!username.value.trim())
    errors.value.username = t(
      "settings.connectionDialogs.validation.usernameRequired",
    );
  // Create mode → password required. Edit mode → empty = keep
  // existing (no rotation), so it's optional.
  if (!props.credential && !password.value) {
    errors.value.password = t(
      "settings.connectionDialogs.validation.passwordRequired",
    );
  }
  return Object.keys(errors.value).length === 0;
};

const submit = async () => {
  if (!validate()) return;
  isLoading.value = true;
  try {
    if (props.credential) {
      // Edit — send only what changed. Password is the most sensitive
      // partial-update: only included when the user typed something.
      await dockerService.registryCredentials.update(props.credential.id, {
        name: name.value.trim(),
        registry_url: registryUrl.value.trim(),
        username: username.value.trim(),
        ...(password.value ? { password: password.value } : {}),
      });
      toast.success(t("settings.connectionDialogs.registry.updated"));
      emit("updated");
    } else {
      await dockerService.registryCredentials.create({
        name: name.value.trim(),
        registry_url: registryUrl.value.trim() || undefined,
        username: username.value.trim(),
        password: password.value,
      });
      toast.success(t("settings.connectionDialogs.registry.saved"));
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (err: unknown) {
    const e = err as { data?: { message?: string } };
    toast.error(
      e.data?.message || t("settings.connectionDialogs.registry.saveFailed"),
    );
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <!--
    Controlled-only dialog — there's no built-in trigger; the
    parent drives open/close via v-model. Lets the parent decide
    whether the same instance handles create vs edit by toggling
    the `credential` prop.
  -->
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {{
            credential
              ? t("settings.connectionDialogs.registry.editTitle")
              : t("settings.connectionDialogs.registry.addTitle")
          }}
        </DialogTitle>
        <DialogDescription>
          {{
            t("settings.connectionDialogs.registry.descriptionBeforeCommand")
          }}
          <code class="font-mono text-xs">docker login</code>
          {{ t("settings.connectionDialogs.registry.descriptionAfterCommand") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid gap-4" @submit.prevent="submit">
        <div class="space-y-1.5">
          <Label for="reg-cred-name">{{
            t("settings.connectionDialogs.name")
          }}</Label>
          <Input
            id="reg-cred-name"
            v-model="name"
            placeholder="ghcr / kkz6"
            autocomplete="off"
          />
          <p class="text-[11px] text-muted-foreground">
            {{ t("settings.connectionDialogs.registry.nameHelp") }}
          </p>
          <p v-if="errors.name" class="text-sm text-destructive">
            {{ errors.name }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="reg-cred-url">{{
            t("settings.connectionDialogs.registry.url")
          }}</Label>
          <Input
            id="reg-cred-url"
            v-model="registryUrl"
            placeholder="ghcr.io"
            autocomplete="off"
          />
          <p class="text-[11px] text-muted-foreground">
            {{ t("settings.connectionDialogs.registry.urlHelp") }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="reg-cred-user">{{
            t("settings.connectionDialogs.username")
          }}</Label>
          <Input id="reg-cred-user" v-model="username" autocomplete="off" />
          <p v-if="errors.username" class="text-sm text-destructive">
            {{ errors.username }}
          </p>
        </div>

        <div class="space-y-1.5">
          <Label for="reg-cred-pass">
            {{ t("settings.connectionDialogs.registry.passwordOrToken") }}
            <span
              v-if="credential"
              class="text-[11px] font-normal text-muted-foreground"
            >
              {{ t("settings.connectionDialogs.registry.keepCurrent") }}
            </span>
          </Label>
          <Input
            id="reg-cred-pass"
            v-model="password"
            type="password"
            :placeholder="credential?.has_password ? '•••••••••' : ''"
            autocomplete="new-password"
          />
          <p v-if="errors.password" class="text-sm text-destructive">
            {{ errors.password }}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" @click="open = false">
            {{ t("settings.connectionDialogs.cancel") }}
          </Button>
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              credential
                ? t("settings.connectionDialogs.saveChanges")
                : t("settings.connectionDialogs.registry.add")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
