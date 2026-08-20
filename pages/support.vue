<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
import * as z from "zod";

definePageMeta({ layout: "site" });

const { t } = useI18n();

useHead({ title: () => t("public.support.pageTitle") });
useSeoMeta({
  description: () => t("public.support.metaDescription"),
});

const SUPPORT_EMAIL = "support@launchctl.io";
const topics = computed(() => [
  { value: "general", label: t("public.support.topics.general") },
  { value: "sales", label: t("public.support.topics.sales") },
  { value: "technical", label: t("public.support.topics.technical") },
  { value: "billing", label: t("public.support.topics.billing") },
]);

const formSchema = computed(() =>
  toTypedSchema(
    z.object({
      name: z.string().min(2, t("public.support.validation.name")),
      email: z.string().email(t("public.support.validation.email")),
      topic: z.string().min(1, t("public.support.validation.topic")),
      message: z.string().min(10, t("public.support.validation.message")),
    }),
  ),
);

const { handleSubmit, errors, defineField } = useForm({
  validationSchema: formSchema,
  initialValues: { name: "", email: "", topic: "general", message: "" },
});

const [name, nameAttrs] = defineField("name");
const [email, emailAttrs] = defineField("email");
const [topic, topicAttrs] = defineField("topic");
const [message, messageAttrs] = defineField("message");

const sent = ref(false);

// No public contact endpoint yet — hand off to the user's mail client with a
// fully composed message so nothing is lost.
const onSubmit = handleSubmit((values) => {
  const topicLabel =
    topics.value.find((item) => item.value === values.topic)?.label ??
    values.topic;
  const subject = t("public.support.email.subject", {
    topic: topicLabel,
    name: values.name,
  });
  const body =
    `${t("public.support.fields.name")}: ${values.name}\n` +
    `${t("public.support.fields.email")}: ${values.email}\n` +
    `${t("public.support.fields.topic")}: ${topicLabel}\n\n` +
    `${values.message}\n`;

  window.location.href = `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;

  sent.value = true;
  toast.success(t("public.support.openingEmailClient"));
});

const fieldClass =
  "w-full rounded-lg border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))] px-3.5 py-2.5 font-site text-sm text-[hsl(var(--site-text))] placeholder:text-[hsl(var(--site-text-muted))]/60 transition-colors focus:border-[hsl(var(--site-accent))]/60 focus:outline-none focus:ring-2 focus:ring-[hsl(var(--site-accent))]/20";
</script>

<template>
  <section class="relative overflow-hidden bg-[hsl(var(--site-bg))]">
    <div
      class="site-grid-pattern pointer-events-none absolute inset-0 opacity-[0.6] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_-10%,black,transparent)]"
    />
    <div
      class="pointer-events-none absolute inset-0 bg-[radial-gradient(55%_45%_at_80%_-5%,theme(colors.emerald.500/8%),transparent)]"
    />

    <div
      class="relative mx-auto grid max-w-6xl gap-x-16 gap-y-12 px-6 pb-28 pt-28 lg:grid-cols-[0.9fr_1.1fr] lg:px-8"
    >
      <!-- intro -->
      <div data-aos="fade-up">
        <span class="font-mono text-xs text-[hsl(var(--site-accent))]"
          ># {{ t("public.support.eyebrow") }}</span
        >
        <h1
          class="mt-3 font-mono text-4xl font-bold tracking-tight text-[hsl(var(--site-text))] sm:text-5xl"
        >
          <RevealText :text="t('public.support.heading')" />
        </h1>
        <p
          class="mt-5 max-w-sm text-lg leading-relaxed text-[hsl(var(--site-text-muted))]"
        >
          {{ t("public.support.description") }}
        </p>

        <div class="mt-8 space-y-3 font-mono text-sm">
          <a
            :href="`mailto:${SUPPORT_EMAIL}`"
            class="flex items-center gap-2.5 text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
          >
            <Icon
              name="lucide:mail"
              class="h-4 w-4 text-[hsl(var(--site-accent))]"
            />
            {{ SUPPORT_EMAIL }}
          </a>
          <NuxtLink
            to="/docs"
            class="flex items-center gap-2.5 text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
          >
            <Icon
              name="lucide:book-open"
              class="h-4 w-4 text-[hsl(var(--site-accent))]"
            />
            {{ t("public.support.readDocs") }}
          </NuxtLink>
        </div>
      </div>

      <!-- form card -->
      <div data-aos="fade-up" data-aos-delay="100">
        <div
          class="rounded-2xl border border-[hsl(var(--site-border))] bg-[hsl(var(--site-surface))]/60 p-6 shadow-xl shadow-emerald-950/[0.06] backdrop-blur-sm sm:p-8"
        >
          <!-- success state -->
          <div v-if="sent" class="flex flex-col items-center py-10 text-center">
            <div
              class="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/20"
            >
              <Icon
                name="lucide:check"
                class="h-6 w-6 text-[hsl(var(--site-accent))]"
              />
            </div>
            <h2
              class="mt-5 font-mono text-lg font-semibold text-[hsl(var(--site-text))]"
            >
              {{ t("public.support.successTitle") }}
            </h2>
            <p
              class="mt-2 max-w-sm text-sm leading-relaxed text-[hsl(var(--site-text-muted))]"
            >
              {{ t("public.support.successDescription") }}
              <a
                :href="`mailto:${SUPPORT_EMAIL}`"
                class="font-medium text-[hsl(var(--site-accent))] underline-offset-2 hover:underline"
                >{{ SUPPORT_EMAIL }}</a
              >.
            </p>
            <button
              type="button"
              class="mt-6 font-mono text-sm text-[hsl(var(--site-text-muted))] transition-colors hover:text-[hsl(var(--site-text))]"
              @click="sent = false"
            >
              ← {{ t("public.support.sendAnother") }}
            </button>
          </div>

          <!-- form -->
          <form v-else class="space-y-5" novalidate @submit.prevent="onSubmit">
            <div class="grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  for="name"
                  class="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[hsl(var(--site-text-muted))]"
                  >{{ t("public.support.fields.name") }}</label
                >
                <input
                  id="name"
                  v-model="name"
                  v-bind="nameAttrs"
                  type="text"
                  autocomplete="name"
                  :placeholder="t('public.support.placeholders.name')"
                  :class="fieldClass"
                />
                <p
                  v-if="errors.name"
                  class="mt-1.5 font-mono text-xs text-rose-500"
                >
                  {{ errors.name }}
                </p>
              </div>
              <div>
                <label
                  for="email"
                  class="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[hsl(var(--site-text-muted))]"
                  >{{ t("public.support.fields.email") }}</label
                >
                <input
                  id="email"
                  v-model="email"
                  v-bind="emailAttrs"
                  type="email"
                  autocomplete="email"
                  :placeholder="t('public.support.placeholders.email')"
                  :class="fieldClass"
                />
                <p
                  v-if="errors.email"
                  class="mt-1.5 font-mono text-xs text-rose-500"
                >
                  {{ errors.email }}
                </p>
              </div>
            </div>

            <div>
              <label
                for="topic"
                class="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[hsl(var(--site-text-muted))]"
                >{{ t("public.support.fields.topic") }}</label
              >
              <select
                id="topic"
                v-model="topic"
                v-bind="topicAttrs"
                :class="[fieldClass, 'appearance-none']"
              >
                <option
                  v-for="item in topics"
                  :key="item.value"
                  :value="item.value"
                >
                  {{ item.label }}
                </option>
              </select>
              <p
                v-if="errors.topic"
                class="mt-1.5 font-mono text-xs text-rose-500"
              >
                {{ errors.topic }}
              </p>
            </div>

            <div>
              <label
                for="message"
                class="mb-1.5 block font-mono text-xs uppercase tracking-wider text-[hsl(var(--site-text-muted))]"
                >{{ t("public.support.fields.message") }}</label
              >
              <textarea
                id="message"
                v-model="message"
                v-bind="messageAttrs"
                rows="5"
                :placeholder="t('public.support.placeholders.message')"
                :class="[fieldClass, 'resize-y']"
              />
              <p
                v-if="errors.message"
                class="mt-1.5 font-mono text-xs text-rose-500"
              >
                {{ errors.message }}
              </p>
            </div>

            <button
              type="submit"
              class="btn-sm btn-site-primary w-full justify-center py-2.5"
            >
              {{ t("public.support.sendMessage") }}
              <Icon name="lucide:arrow-right" class="ml-2 h-4 w-4" />
            </button>

            <p
              class="text-center font-mono text-xs text-[hsl(var(--site-text-muted))]/70"
            >
              {{ t("public.support.privacyNote") }}
            </p>
          </form>
        </div>
      </div>
    </div>
  </section>
</template>
