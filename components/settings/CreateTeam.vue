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

const emit = defineEmits<{
  created: [];
}>();

const isOpen = ref(false);
const isLoading = ref(false);

const formSchema = toTypedSchema(
  z.object({
    name: z.string().min(1, "Team name is required"),
  })
);

const form = useForm({
  validationSchema: formSchema,
  initialValues: {
    name: "",
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
    await $api("/teams", {
      method: "POST",
      body: values,
    });
    toast.success("Team created successfully");
    isOpen.value = false;
    form.resetForm();
    emit("created");
  } catch (error: unknown) {
    if (error && typeof error === "object" && "data" in error) {
      const fetchError = error as { data?: { message?: string } };
      toast.error(fetchError.data?.message || "Failed to create team");
    } else {
      toast.error("Failed to create team");
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
          <Icon name="lucide:plus" class="mr-2 h-4 w-4" />
          Create Team
        </Button>
      </slot>
    </DialogTrigger>
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Create Team</DialogTitle>
        <DialogDescription>
          Create a new team to collaborate with others
        </DialogDescription>
      </DialogHeader>

      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <FormField v-slot="{ componentField }" name="name">
          <FormItem>
            <FormLabel>Team Name</FormLabel>
            <FormControl>
              <Input placeholder="My Team" v-bind="componentField" />
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
            Create Team
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
