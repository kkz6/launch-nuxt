<script setup lang="ts">
import { toast } from "vue-sonner";
import * as z from "zod";
import { Button } from "~/components/ui/button";
import { Badge } from "~/components/ui/badge";
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
import {
  dockerService,
  type DockerApplication,
  type DockerApplicationRedirect,
} from "~/services/dockerService";

interface Props {
  application: DockerApplication;
  redirect?: DockerApplicationRedirect;
}

const props = defineProps<Props>();
const { t } = useI18n();

const emit = defineEmits<{
  created: [];
  updated: [];
}>();

const open = defineModel<boolean>("open", { default: false });
const isLoading = ref(false);
const errors = ref<Record<string, string>>({});

// Form state. Mirrors the PHP-site CreateRedirect dialog exactly —
// same field set, same validation, same live preview.
const from = ref(props.redirect?.from || "");
const to = ref(props.redirect?.to || "");
const redirectType = ref(props.redirect?.type?.toString() || "301");

const redirectTypes = computed(() => [
  {
    value: "301",
    label: t("workload.redirects.permanent", { code: 301 }),
    description: t("workload.redirects.recommendedSeo"),
  },
  {
    value: "302",
    label: t("workload.redirects.temporary", { code: 302 }),
    description: t("workload.redirects.temporaryDescription"),
  },
  {
    value: "307",
    label: t("workload.redirects.temporary", { code: 307 }),
    description: t("workload.redirects.preservesMethod"),
  },
  {
    value: "308",
    label: t("workload.redirects.permanent", { code: 308 }),
    description: t("workload.redirects.preservesMethod"),
  },
]);

const schema = computed(() =>
  z.object({
    from: z
      .string()
      .min(1, t("workload.redirects.fromRequired"))
      .regex(/^\//, t("workload.redirects.pathSlashRequired")),
    to: z.string().min(1, t("workload.redirects.toRequired")),
    type: z
      .number()
      .refine(
        (val) => [301, 302, 307, 308].includes(val),
        t("workload.redirects.invalidType"),
      ),
  }),
);

const canSubmit = computed(() => {
  if (isLoading.value) return false;
  if (from.value.trim().length === 0) return false;
  if (to.value.trim().length === 0) return false;
  return true;
});

const isPatternRedirect = computed(() => from.value.includes("*"));

// The preview needs a base URL. For docker apps the canonical hostname
// is whichever domain is attached on the Domains tab — we don't have
// that loaded here, so we fall back to a generic placeholder. This
// matches what dokploy + the PHP site do when no site_address is set.
const previewBase = "https://yourdomain.com";

const previewExamples = computed(() => {
  const fromPath = from.value.trim() || "/old-path";
  const toPath = to.value.trim() || "/new-path";

  if (isPatternRedirect.value) {
    const examplePath = fromPath.replace("*", "example-page");
    const exampleTo = toPath.includes("{path}")
      ? toPath.replace("{path}", "example-page")
      : toPath;
    return [
      {
        from: `${previewBase}${examplePath}`,
        to: exampleTo.startsWith("http")
          ? exampleTo
          : `${previewBase}${exampleTo}`,
      },
    ];
  }
  return [
    {
      from: `${previewBase}${fromPath}`,
      to: toPath.startsWith("http") ? toPath : `${previewBase}${toPath}`,
    },
  ];
});

const resetForm = () => {
  from.value = props.redirect?.from || "";
  to.value = props.redirect?.to || "";
  redirectType.value = props.redirect?.type?.toString() || "301";
  errors.value = {};
};

const validate = () => {
  const result = schema.value.safeParse({
    from: from.value.trim(),
    to: to.value.trim(),
    type: parseInt(redirectType.value, 10),
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    errors.value = {
      from: fieldErrors.from?.[0] || "",
      to: fieldErrors.to?.[0] || "",
      type: fieldErrors.type?.[0] || "",
    };
    return null;
  }
  errors.value = {};
  return result.data;
};

const onSubmit = async () => {
  const data = validate();
  if (!data) return;

  isLoading.value = true;
  try {
    const isEdit = !!props.redirect;
    if (isEdit) {
      await dockerService.applications.updateRedirect(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        props.redirect!.id,
        {
          from: data.from,
          to: data.to,
          type: data.type as 301 | 302 | 307 | 308,
        },
      );
      toast.success(t("workload.redirects.updated"));
      emit("updated");
    } else {
      await dockerService.applications.createRedirect(
        props.application.server_id,
        props.application.project_id,
        props.application.id,
        {
          from: data.from,
          to: data.to,
          type: data.type as 301 | 302 | 307 | 308,
        },
      );
      toast.success(t("workload.redirects.created"));
      emit("created");
    }
    open.value = false;
    resetForm();
  } catch (error: unknown) {
    const err = error as {
      data?: { errors?: Record<string, string[]>; message?: string };
    };
    if (err.data?.errors) {
      for (const [field, messages] of Object.entries(err.data.errors)) {
        errors.value[field] = messages[0];
      }
    } else {
      toast.error(
        err.data?.message ||
          (props.redirect
            ? t("workload.redirects.updateFailed")
            : t("workload.redirects.createFailed")),
      );
    }
  } finally {
    isLoading.value = false;
  }
};

watch(open, (isOpen) => {
  if (isOpen) resetForm();
});
</script>

<template>
  <Dialog v-model:open="open">
    <DialogTrigger as-child>
      <Button>
        <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
        {{ t("workload.redirects.add") }}
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>
          {{
            redirect
              ? t("workload.redirects.updateTitle")
              : t("workload.redirects.createTitle")
          }}
        </DialogTitle>
        <DialogDescription>
          {{ t("workload.redirects.formDescription") }}
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="redirect-from">{{
            t("workload.redirects.fromPath")
          }}</Label>
          <Input
            id="redirect-from"
            v-model="from"
            placeholder="/old-page or /blog/*"
          />
          <p v-if="errors.from" class="text-sm text-destructive">
            {{ errors.from }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            {{ t("workload.redirects.patternBefore") }}
            <code class="rounded bg-muted px-1">*</code>
            {{ t("workload.redirects.patternBetween") }}
            <code class="rounded bg-muted px-1">/blog/*</code
            >{{ t("workload.redirects.patternAfter") }}
          </p>
        </div>

        <div class="space-y-2">
          <Label for="redirect-to">{{ t("workload.redirects.toPath") }}</Label>
          <Input
            id="redirect-to"
            v-model="to"
            placeholder="/new-page or /news/{path}"
          />
          <p v-if="errors.to" class="text-sm text-destructive">
            {{ errors.to }}
          </p>
          <p v-else class="text-sm text-muted-foreground">
            <template v-if="isPatternRedirect">
              {{ t("workload.redirects.wildcardBefore") }}
              <code class="rounded bg-muted px-1">{path}</code>
              {{ t("workload.redirects.wildcardAfter") }}
            </template>
            <template v-else>{{ t("workload.redirects.enterPath") }}</template>
          </p>
        </div>

        <div class="space-y-2">
          <Label for="redirect-type">{{ t("workload.redirects.type") }}</Label>
          <Select v-model="redirectType">
            <SelectTrigger id="redirect-type">
              <SelectValue :placeholder="t('workload.redirects.selectType')" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="rt in redirectTypes"
                :key="rt.value"
                :value="rt.value"
              >
                <span>{{ rt.label }}</span>
                <span class="ml-2 text-muted-foreground">
                  - {{ rt.description }}
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          <p v-if="errors.type" class="text-sm text-destructive">
            {{ errors.type }}
          </p>
        </div>

        <!-- Live preview — same pattern the PHP-site dialog uses so
             the user can sanity-check the regex/path before saving. -->
        <div
          v-if="from.trim() && to.trim()"
          class="rounded-lg border bg-muted/50 p-4"
        >
          <div class="mb-3 flex items-center gap-2">
            <Icon name="lucide:eye" class="h-4 w-4 text-muted-foreground" />
            <span class="text-sm font-medium">{{
              t("workload.redirects.preview")
            }}</span>
            <Badge v-if="isPatternRedirect" variant="secondary" class="text-xs">
              {{ t("workload.redirects.pattern") }}
            </Badge>
            <Badge v-else variant="outline" class="text-xs">
              {{ t("workload.redirects.exact") }}
            </Badge>
          </div>
          <div
            v-for="(example, index) in previewExamples"
            :key="index"
            class="space-y-2"
          >
            <div class="flex items-baseline gap-2">
              <span
                class="w-8 shrink-0 text-xs font-medium text-muted-foreground"
              >
                {{ t("workload.redirects.from") }}
              </span>
              <code
                class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs"
              >
                {{ example.from }}
              </code>
            </div>
            <div class="flex items-baseline gap-2">
              <span
                class="w-8 shrink-0 text-xs font-medium text-muted-foreground"
              >
                {{ t("workload.redirects.to") }}
              </span>
              <code
                class="min-w-0 break-all rounded bg-background px-2 py-1 text-xs"
              >
                {{ example.to }}
              </code>
            </div>
          </div>
        </div>

        <DialogFooter class="mt-4">
          <Button type="button" variant="outline" @click="open = false">
            {{ t("workload.actions.cancel") }}
          </Button>
          <Button type="submit" :disabled="!canSubmit">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            {{
              redirect
                ? t("workload.actions.update")
                : t("workload.actions.create")
            }}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
