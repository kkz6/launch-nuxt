<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '~/components/ui/dialog'
import { Input } from '~/components/ui/input'
import { Label } from '~/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '~/components/ui/select'
import type { LoadBalancerUpstream } from '~/types'
import { serverService } from '~/services/serverService'

interface Props {
  serverId: string
  upstream: LoadBalancerUpstream
}

const props = defineProps<Props>()
const emit = defineEmits<{
  updated: []
}>()

const isOpen = ref(false)
const isLoading = ref(false)

// Form values
const name = ref(props.upstream.name)
const lbPolicy = ref(props.upstream.lb_policy)
const healthCheckPath = ref(props.upstream.health_check_path)
const healthCheckInterval = ref(props.upstream.health_check_interval)
const healthCheckTimeout = ref(props.upstream.health_check_timeout)

const lbPolicies = [
  { value: 'round_robin', label: 'Round Robin' },
  { value: 'least_conn', label: 'Least Connections' },
  { value: 'ip_hash', label: 'IP Hash' },
  { value: 'first', label: 'First Available' },
  { value: 'random', label: 'Random' },
]

const resetForm = () => {
  name.value = props.upstream.name
  lbPolicy.value = props.upstream.lb_policy
  healthCheckPath.value = props.upstream.health_check_path
  healthCheckInterval.value = props.upstream.health_check_interval
  healthCheckTimeout.value = props.upstream.health_check_timeout
}

const onSubmit = async () => {
  isLoading.value = true
  try {
    await serverService.loadBalancer.upstreams.update(props.serverId, props.upstream.id, {
      name: name.value.trim(),
      lb_policy: lbPolicy.value,
      health_check_path: healthCheckPath.value.trim(),
      health_check_interval: healthCheckInterval.value.trim(),
      health_check_timeout: healthCheckTimeout.value.trim(),
    })
    toast.success('Upstream updated')
    emit('updated')
    isOpen.value = false
  } catch (error: unknown) {
    const err = error as { data?: { message?: string } }
    toast.error(err.data?.message || 'Failed to update upstream')
  } finally {
    isLoading.value = false
  }
}

watch(isOpen, (open) => {
  if (!open) resetForm()
})
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogTrigger as-child>
      <Button variant="ghost" size="icon" class="h-8 w-8">
        <Icon name="lucide:pencil" class="h-4 w-4" />
      </Button>
    </DialogTrigger>
    <DialogContent class="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Edit Upstream</DialogTitle>
      </DialogHeader>
      <form class="grid w-full gap-4" @submit.prevent="onSubmit">
        <div class="space-y-2">
          <Label for="edit-name">Name</Label>
          <Input id="edit-name" v-model="name" />
        </div>

        <div class="space-y-2">
          <Label>Domain</Label>
          <Input :model-value="upstream.address" disabled class="bg-muted" />
          <p class="text-xs text-muted-foreground">Domain cannot be changed after creation</p>
        </div>

        <div class="space-y-2">
          <Label>Load Balancing Policy</Label>
          <Select v-model="lbPolicy">
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                v-for="policy in lbPolicies"
                :key="policy.value"
                :value="policy.value"
              >
                {{ policy.label }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div class="space-y-2">
          <Label for="edit-health-path">Health Check Path</Label>
          <Input id="edit-health-path" v-model="healthCheckPath" placeholder="/" />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div class="space-y-2">
            <Label for="edit-health-interval">Check Interval</Label>
            <Input id="edit-health-interval" v-model="healthCheckInterval" placeholder="30s" />
          </div>
          <div class="space-y-2">
            <Label for="edit-health-timeout">Check Timeout</Label>
            <Input id="edit-health-timeout" v-model="healthCheckTimeout" placeholder="10s" />
          </div>
        </div>

        <DialogFooter>
          <Button type="submit" :disabled="isLoading">
            <Icon v-if="isLoading" name="lucide:loader-2" class="mr-2 h-4 w-4 animate-spin" />
            Update
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
