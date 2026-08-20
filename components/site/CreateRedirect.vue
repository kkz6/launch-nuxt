<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";

interface Redirect {
  id: string;
  from: string;
  to: string;
  type: number;
}

interface Props {
  serverId: string;
  siteId: string;
  siteAddress?: string;
  redirect?: Redirect;
}

const props = defineProps<Props>();
const { locale, t } = useI18n();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});
const hasClientValidationErrors = ref(false);

// Form values
const from = ref(props.redirect?.from || "");
const to = ref(props.redirect?.to || "");
const redirectType = ref(props.redirect?.type?.toString() || "301");

const redirectTypes = computed(() => [
  {
    value: "301",
    label: t("site.redirects.permanent301"),
    description: t("site.redirectForm.seoRecommended"),
  },
  {
    value: "302",
    label: t("site.redirects.temporary302"),
    description: t("site.redirectForm.temporaryDescription"),
  },
  {
    value: "307",
    label: t("site.redirects.temporary307"),
    description: t("site.redirectForm.preservesMethod"),
  },
  {
    value: "308",
    label: t("site.redirects.permanent308"),
    description: t("site.redirectForm.preservesMethod"),
  },
]);

const schema = computed(() =>
  z.object({
    from: z
      .string()
      .min(1, t("site.redirectForm.fromRequired"))
      .regex(/^\//, t("site.redirectForm.pathMustStartSlash")),
    to: z.string().min(1, t("site.redirectForm.toRequired")),
    type: z
      .number()
      .refine(
        (val) => [301, 302, 307, 308].includes(val),
        t("site.redirectForm.invalidType"),
      ),
  }),
);

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (from.value.trim().length === 0) return false;
  if (to.value.trim().length === 0) return false;
  return true;
});

// Detect if it's a pattern redirect
const isPatternRedirect = computed(() => {
  return from.value.includes("*");
});

// Generate preview examples
const previewExamples = computed(() => {
  const baseUrl = props.siteAddress
    ? `https://${props.siteAddress}`
    : "https://yoursite.com";
  const fromPath = from.value.trim() || "/old-path";
  const toPath = to.value.trim() || "/new-path";

  if (isPatternRedirect.value) {
    // Pattern redirect preview
    const examplePath = fromPath.replace("*", "example-page");
    const exampleTo = toPath.includes("{path}")
      ? toPath.replace("{path}", "example-page")
      : toPath;

    return [
      {
        from: `${baseUrl}${examplePath}`,
        to: exampleTo.startsWith("http") ? exampleTo : `${baseUrl}${exampleTo}`,
      },
    ];
  }

  // Exact redirect preview
  return [
    {
      from: `${baseUrl}${fromPath}`,
      to: toPath.startsWith("http") ? toPath : `${baseUrl}${toPath}`,
    },
  ];
});

const resetForm = () => {
  from.value = props.redirect?.from || "";
  to.value = props.redirect?.to || "";
  redirectType.value = props.redirect?.type?.toString() || "301";
  errors.value = {};
  hasClientValidationErrors.value = false;
};

const validate = () => {
  const result = schema.value.safeParse({
    from: from.value.trim(),
    to: to.value.trim(),
    type: parseInt(redirectType.value, 10),
  });
  if (!result.success) {
    hasClientValidationErrors.value = true;
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      from: fieldErrors.from?.[0] || "",
      to: fieldErrors.to?.[0] || "",
      type: fieldErrors.type?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  hasClientValidationErrors.value = false;
  return result.data;
};

watch(locale, () => {
  if (hasClientValidationErrors.value) validate();
});

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    const isEdit = !!props.redirect;
    const url = isEdit
      ? `/servers/${props.serverId}/sites/${props.siteId}/redirects/${props.redirect!.id}`
      : `/servers/${props.serverId}/sites/${props.siteId}/redirects`;

    await $api(url, {
      method: isEdit ? "PATCH" : "POST",
      body: data,
    });

    toast.success(
      isEdit ? t("site.redirectForm.updated") : t("site.redirectForm.created"),
    );
    open.value = false;
    resetForm();
    if (isEdit) {
      emit("updated");
    } else {
      emit("created");
    }
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      hasClientValidationErrors.value = false;
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message ||
          t(
            props.redirect
              ? "site.redirectForm.updateFailed"
              : "site.redirectForm.createFailed",
          ),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("site.redirectForm.add") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {{
            redirect
              ? t("site.redirectForm.updateTitle")
              : t("site.redirectForm.createTitle")
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("site.redirectForm.description") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="from">{{ t("site.redirectForm.fromPath") }}</Label>
          <Input
            id="from"
            v-model="from"
            :placeholder="t('site.redirectForm.fromPlaceholder')"
          />
          <p v-if="errors.from" class="text-sm text-destructive">
            {{ errors.from }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            {{ t("site.redirectForm.patternHelp") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="to">{{ t("site.redirectForm.toPath") }}</Label>
          <Input
            id="to"
            v-model="to"
            :placeholder="
              t('site.redirectForm.toPlaceholder', { path: '{path}' })
            "
          />
          <p v-if="errors.to" class="text-sm text-destructive">
            {{ errors.to }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            <template v-if="isPatternRedirect">
              {{ t("site.redirectForm.wildcardHelp", { path: "{path}" }) }}
            </template>
            <template v-else>
              {{ t("site.redirectForm.destinationHelp") }}
            </template>
          </p>
        </div>

        <div class="space-y-2">
          <Label for="type">{{ t("site.redirectForm.redirectType") }}</Label>
          <Select v-model="redirectType">
            <SelectTrigger>
              <SelectValue :placeholder="t('site.redirectForm.selectType')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="rt in redirectTypes"
                :key="rt.value"
                :value="rt.value"
              >
                <span>{{ rt.label }}</span>
                <span class="ml-2 text-muted-foreground"
                  >- {{ rt.description }}</span
                >
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.type" class="text-sm text-destructive">
            {{ errors.type }}
          </p>
        </div>

        <!-- Live Preview -->
        <div
          v-if="from.trim() && to.trim()"
          class="rounded-lg border bg-muted/50 p-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:eye" class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{
              t("site.redirectForm.preview")
            }}</span>
            <Badge v-if="isPatternRedirect" variant="secondary" class="text-xs">
              {{ t("site.redirectForm.pattern") }}
            </Badge>
            <Badge v-else variant="outline" class="text-xs">{{
              t("site.redirectForm.exact")
            }}</Badge>
          </div>
          <div
            v-for="(example, index) in previewExamples"
            :key="index"
            class="space-y-2"
          >
            <div class="flex items-baseline gap-2">
              <span
                class="w-8 shrink-0 text-xs font-medium text-muted-foreground"
                >{{ t("site.common.from") }}</span
              >
              <code
                class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs"
                >{{ example.from }}</code
              >
            </div>
            <div class="flex items-baseline gap-2">
              <span
                class="w-8 shrink-0 text-xs font-medium text-muted-foreground"
                >{{ t("site.common.to") }}</span
              >
              <code
                class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs"
                >{{ example.to }}</code
              >
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            {{ t("site.common.cancel") }}
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{ redirect ? t("site.common.update") : t("site.common.create") }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
