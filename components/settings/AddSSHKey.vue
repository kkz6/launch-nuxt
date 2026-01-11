<script setup lang="ts">
import { toast } from "vue-sonner";
import { useForm } from "vee-validate";
import { toTypedSchema } from "@vee-validate/zod";
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
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "~/components/ui/form";
import { Input } from "~/components/ui/input";
import { Textarea } from "~/components/ui/textarea";

const emit = defineEmits<{
  created: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    public_key: z.string().min(1, "Public key is required"),
  })
);

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: "",
    description: "",
    public_key: "",
  },
  validateOnMount: false,
});

const handleClose = (open: boolean) => {
  if (!open) {
    form.resetForm();
  }
};

const onSubmit = form.handleSubmit(async (values) => {
  isLoading.value = true;
  try {
    await $api("/ssh-keys", {
      method: "POST",
      body: values,
    });
    toast.success("SSH key added successfully");
    isOpen.value = false;
    form.resetForm();
    emit("created");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(fetchError.data?.message || "Failed to add SSH key");
    } else {
      toast.error("Failed to add SSH key");
    }
  } finally {
    isLoading.value = false;
  }
});
</script>

<template>
  <Dialog v-model:open="isOpen" @update:open="handleClose">
    <DialogTrigger as-child>
      <slot>
        <Button>
          <Icon name="lucide:key-round" class="mr-2 h-4 w-4" />
          Add SSH Key
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-xl">
      <DialogHeader>
        <DialogTitle>Add SSH Key</DialogTitle>
        <DialogDescription>
          Add a new SSH key for secure server access
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Name</FormLabel>
            <FormControl>
              <Input placeholder="My SSH Key" v-bind="componentField" />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="description">
          <FormItem>
            <FormLabel>Description (Optional)</FormLabel>
            <FormControl>
              <Input
                placeholder="Work laptop key"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <FormField v-slot="{ componentField }" name="public_key">
          <FormItem>
            <FormLabel>Public Key</FormLabel>
            <FormControl>
              <Textarea
                placeholder="ssh-rsa AAAAB3NzaC1..."
                class="min-h-[120px] font-mono text-sm"
                v-bind="componentField"
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        </FormField>

        <DialogFooter class="mt-4 sm:justify-start">
          <Button type="submit" :disabled="isLoading">
            <Icon
              v-if="isLoading"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            Add SSH Key
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
