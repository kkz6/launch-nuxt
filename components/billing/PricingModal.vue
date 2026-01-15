<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
import { Switch } from '~/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '~/components/ui/dialog'

interface PlanOption {
  id: string
  name: string
  description?: string
  monthly_pricing: number
  yearly_pricing: number
  features: string[]
  recommended?: boolean
}

interface Props {
  plans: PlanOption[]
  currentPlanId?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  selectPlan: [planId: string, isAnnual: boolean]
}>()

const isOpen = defineModel<boolean>('isOpen', { required: true })
const isAnnual = ref(false)
const isLoading = ref<string | null>(null)

// Format price from cents to dollars
const formatPrice = (cents: number) => {
  const dollars = cents / 100
  return dollars % 1 === 0 ? dollars.toString() : dollars.toFixed(2)
}

// Calculate yearly savings percentage
const getSavingsPercent = (plan: PlanOption) => {
  const monthlyTotal = plan.monthly_pricing * 12
  const yearlyTotal = plan.yearly_pricing
  return Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100)
}

const handleSelectPlan = (planId: string) => {
  isLoading.value = planId
  emit('selectPlan', planId, isAnnual.value)
}

const currentPlan = computed(() => props.plans.find(p => p.id === props.currentPlanId))
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader class="text-center">
        <DialogTitle class="text-2xl font-bold">
          Choose your plan
        </DialogTitle>
        <p class="text-muted-foreground">
          Select the plan that best fits your needs
        </p>
      </DialogHeader>

      <!-- Billing Toggle -->
      <div class="flex items-center justify-center gap-3 py-4">
        <span :class="['text-sm font-medium', !isAnnual ? 'text-foreground' : 'text-muted-foreground']">
          Monthly
        </span>
        <Switch v-model="isAnnual" />
        <span :class="['text-sm font-medium', isAnnual ? 'text-foreground' : 'text-muted-foreground']">
          Yearly
        </span>
        <Badge v-if="isAnnual" variant="secondary" class="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
          Save up to 20%
        </Badge>
      </div>

      <!-- Plans Grid -->
      <div class="grid gap-4 md:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'relative flex flex-col rounded-2xl border-2 p-6 transition-all',
            plan.recommended
              ? 'border-primary shadow-lg shadow-primary/10'
              : 'border-border hover:border-primary/50',
            plan.id === currentPlanId && 'bg-muted/50',
          ]"
        >
          <!-- Recommended Badge -->
          <div v-if="plan.recommended" class="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge class="bg-primary text-primary-foreground">
              Most Popular
            </Badge>
          </div>

          <!-- Current Plan Badge -->
          <div v-if="plan.id === currentPlanId" class="absolute -top-3 right-4">
            <Badge variant="outline" class="bg-background">
              Current
            </Badge>
          </div>

          <!-- Plan Header -->
          <div class="mb-4 text-center">
            <h3 class="text-lg font-semibold">{{ plan.name }}</h3>
            <p v-if="plan.description" class="mt-1 text-sm text-muted-foreground">
              {{ plan.description }}
            </p>
          </div>

          <!-- Price -->
          <div class="mb-6 text-center">
            <div class="flex items-baseline justify-center gap-1">
              <span class="text-4xl font-bold">
                ${{ formatPrice(isAnnual ? plan.yearly_pricing / 12 : plan.monthly_pricing) }}
              </span>
              <span class="text-muted-foreground">/mo</span>
            </div>
            <p v-if="isAnnual" class="mt-1 text-sm text-muted-foreground">
              ${{ formatPrice(plan.yearly_pricing) }} billed yearly
            </p>
            <p v-if="isAnnual && getSavingsPercent(plan) > 0" class="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Save {{ getSavingsPercent(plan) }}%
            </p>
          </div>

          <!-- Features -->
          <ul class="mb-6 flex-1 space-y-3">
            <li
              v-for="(feature, index) in plan.features"
              :key="index"
              class="flex items-start gap-2 text-sm"
            >
              <Icon name="lucide:check" class="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-500" />
              <span>{{ feature }}</span>
            </li>
          </ul>

          <!-- CTA Button -->
          <Button
            :variant="plan.recommended ? 'default' : 'outline'"
            :disabled="plan.id === currentPlanId || isLoading !== null"
            class="w-full"
            @click="handleSelectPlan(plan.id)"
          >
            <Icon
              v-if="isLoading === plan.id"
              name="lucide:loader-2"
              class="mr-2 h-4 w-4 animate-spin"
            />
            <template v-if="plan.id === currentPlanId">
              Current Plan
            </template>
            <template v-else-if="currentPlanId">
              Switch to {{ plan.name }}
            </template>
            <template v-else>
              Get Started
            </template>
          </Button>
        </div>
      </div>

      <!-- Footer Note -->
      <p class="pt-4 text-center text-xs text-muted-foreground">
        All plans include a 14-day free trial. Cancel anytime.
      </p>
    </DialogContent>
  </Dialog>
</template>
