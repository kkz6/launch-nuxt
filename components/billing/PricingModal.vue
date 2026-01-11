<script setup lang="ts">
import { Button } from '~/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'
import { RadioGroup, RadioGroupItem } from '~/components/ui/radio-group'

interface PlanOption {
  id: number
  name: string
  monthly_pricing: number
  yearly_pricing: number
  features: string[]
  recommended?: boolean
}

interface Props {
  plans: PlanOption[]
  isOpen: boolean
  currentPlanId?: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:isOpen': [boolean]
  selectPlan: [planId: number, isAnnual: boolean]
}>()

const availablePlans = computed(() =>
  props.plans.filter((plan) => plan.id !== props.currentPlanId)
)

const selectedPlan = ref<string>(availablePlans.value[0]?.id.toString() ?? '')

watch(availablePlans, (plans) => {
  if (plans.length > 0 && !selectedPlan.value) {
    selectedPlan.value = plans[0].id.toString()
  }
})

const onOpenChange = (open: boolean) => {
  emit('update:isOpen', open)
}

const handleSelectPlan = (isAnnual: boolean) => {
  if (selectedPlan.value) {
    emit('selectPlan', Number(selectedPlan.value), isAnnual)
  }
}
</script>

<template>
  <Dialog :open="isOpen" @update:open="onOpenChange">
    <DialogContent class="bg-background sm:max-w-[600px]">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2 text-xl font-semibold">
          <Icon name="lucide:zap" class="h-5 w-5" />
          Choose a Plan
        </DialogTitle>
        <DialogDescription>
          Select a subscription plan that fits your needs
        </DialogDescription>
      </DialogHeader>

      <div v-if="currentPlanId" class="mb-4 rounded-lg bg-muted p-4">
        <h3 class="mb-2 text-sm font-medium">Current Plan</h3>
        <div class="flex items-center justify-between">
          <span class="text-sm text-muted-foreground">
            {{ plans.find((p) => p.id === currentPlanId)?.name }}
          </span>
          <span class="text-sm font-medium">
            ${{ plans.find((p) => p.id === currentPlanId)?.monthly_pricing.toFixed(2) }}/mo
          </span>
        </div>
      </div>

      <RadioGroup v-model="selectedPlan" class="space-y-4 py-4">
        <label
          v-for="plan in availablePlans"
          :key="plan.id"
          class="relative flex cursor-pointer flex-col rounded-xl border-2 p-4 transition-all"
          :class="[
            selectedPlan === plan.id.toString()
              ? 'border-primary bg-primary/5'
              : 'border-border hover:border-primary/50',
          ]"
        >
          <RadioGroupItem :value="plan.id.toString()" class="sr-only" />
          <div class="mb-2 flex items-center justify-between">
            <div>
              <h3 class="text-sm font-semibold">{{ plan.name }}</h3>
              <span v-if="plan.recommended" class="text-xs text-primary">
                Recommended
              </span>
            </div>
            <div class="flex items-baseline">
              <span class="text-2xl font-bold">${{ plan.monthly_pricing.toFixed(2) }}</span>
              <span class="ml-1 text-muted-foreground">/mo</span>
            </div>
          </div>
          <ul class="mt-4 space-y-2">
            <li
              v-for="(feature, index) in plan.features"
              :key="index"
              class="flex items-center text-sm text-muted-foreground"
            >
              <Icon name="lucide:check" class="mr-2 h-4 w-4 text-primary" />
              {{ feature }}
            </li>
          </ul>
          <div v-if="selectedPlan === plan.id.toString()" class="absolute -right-2 -top-2">
            <span class="flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <Icon name="lucide:check" class="h-3 w-3 text-primary-foreground" />
            </span>
          </div>
        </label>
      </RadioGroup>

      <DialogFooter class="flex flex-col gap-2">
        <Button :disabled="!selectedPlan" class="w-full" @click="handleSelectPlan(false)">
          Subscribe Monthly
        </Button>
        <Button variant="outline" class="w-full" @click="handleSelectPlan(true)">
          Subscribe Yearly (Save 20%)
        </Button>
        <Button variant="ghost" class="w-full" @click="onOpenChange(false)">
          Cancel
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
