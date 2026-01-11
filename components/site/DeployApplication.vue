<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'

interface Props {
  serverId: string
  siteId: string
  asIcon?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  asIcon: false,
})

const isOpen = ref(false)
const isLoading = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const deploy = async () => {
  if (!confirmationDialog.value) return

  const result = await confirmationDialog.value.show({
    title: 'Deploy Application',
    description: 'Are you sure you want to deploy this application? This will pull the latest changes and run your deployment script.',
    confirmText: 'Deploy',
    cancelText: 'Cancel',
  })

  if (!result.ok) {
    return
  }

  isLoading.value = true
  try {
    await $api(`/servers/${props.serverId}/sites/${props.siteId}/deploy`, {
      method: 'POST',
    })
    toast.success('Deployment initiated')
    isOpen.value = false
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to deploy')
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button v-if="asIcon" variant="ghost" size="icon">
        <Icon name="lucide:rocket" class="h-4 w-4" />
      </Button>
      <Button v-else>
        <Icon name="lucide:rocket" class="mr-2 h-4 w-4" />
        Deploy
      </Button>
    </DialogTrigger>
    <DialogContent>
      <SharedConfirmationDialog ref="confirmationDialog" />
      <DialogHeader>
        <DialogTitle>Deploy Application</DialogTitle>
        <DialogDescription>
          This will deploy the latest version of your application from the repository.
        </DialogDescription>
      </DialogHeader>
      <div class="py-4">
        <p class="text-sm text-muted-foreground">
          The deployment will:
        </p>
        <ul class="mt-2 list-disc pl-4 text-sm text-muted-foreground">
          <li>Pull latest changes from your repository</li>
          <li>Install dependencies</li>
          <li>Run your deployment script</li>
          <li>Restart services if needed</li>
        </ul>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="isOpen = false">Cancel</Button>
        <Button :disabled="isLoading" @click="deploy">
          <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
          Deploy Now
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
