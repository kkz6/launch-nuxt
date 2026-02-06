<script setup lang="ts">
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'
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

const resetLoading = () => {
  isLoading.value = null
}

defineExpose({ resetLoading })

const currentPlan = computed(() => props.plans.find(p => p.id === props.currentPlanId))
</script>

<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-4xl">
      <!-- Header -->
      <div class="border-b px-6 py-6 text-center">
        <DialogHeader>
          <DialogTitle class="text-xl font-semibold">
            Choose your plan
          </DialogTitle>
          <p class="mt-1.5 text-sm text-muted-foreground">
            Select the plan that best fits your needs
          </p>
        </DialogHeader>

        <!-- Billing Toggle -->
        <div class="mt-5 inline-flex items-center rounded-full border bg-muted/50 p-1">
          <button
            :class="[
              'relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              !isAnnual
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="isAnnual = false"
          >
            Monthly
          </button>
          <button
            :class="[
              'relative rounded-full px-5 py-2 text-sm font-medium transition-all duration-200',
              isAnnual
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground',
            ]"
            @click="isAnnual = true"
          >
            Yearly
            <span v-if="!isAnnual" class="ml-1.5 inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              -20%
            </span>
          </button>
        </div>
      </div>

      <!-- Plans Grid -->
      <div class="grid gap-4 p-6 md:grid-cols-3">
        <div
          v-for="plan in plans"
          :key="plan.id"
          :class="[
            'group relative flex flex-col rounded-xl border bg-card p-5 transition-all duration-200',
            plan.recommended
              ? 'border-primary/50 ring-2 ring-primary/20'
              : 'border-border hover:border-primary/30 hover:shadow-lg',
            plan.id === currentPlanId && 'bg-primary/5',
          ]"
        >
          <!-- Recommended Badge -->
          <div
            v-if="plan.recommended"
            class="absolute -top-3 left-1/2 -translate-x-1/2"
          >
            <span class="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-primary to-primary/80 px-3 py-1 text-xs font-semibold text-primary-foreground shadow-lg shadow-primary/25">
              <Icon name="lucide:sparkles" class="h-3 w-3" />
              Popular
            </span>
          </div>

          <!-- Plan Header -->
          <div class="mb-4 pt-2 text-center">
            <div class="flex items-center justify-center gap-2">
              <h3 class="text-lg font-semibold">{{ plan.name }}</h3>
              <Badge v-if="plan.id === currentPlanId" variant="secondary" class="text-xs">
                Current
              </Badge>
            </div>
            <p v-if="plan.description" class="mt-1 text-sm text-muted-foreground">
              {{ plan.description }}
            </p>
          </div>

          <!-- Price -->
          <div class="mb-5 text-center">
            <div class="flex items-baseline justify-center">
              <span class="text-sm font-medium text-muted-foreground">$</span>
              <span class="text-4xl font-bold tracking-tight">
                {{ formatPrice(isAnnual ? plan.yearly_pricing / 12 : plan.monthly_pricing) }}
              </span>
              <span class="ml-1 text-sm text-muted-foreground">/mo</span>
            </div>
            <div class="mt-1.5 h-5">
              <p v-if="isAnnual" class="text-xs text-muted-foreground">
                ${{ formatPrice(plan.yearly_pricing) }}/year
                <span v-if="getSavingsPercent(plan) > 0" class="ml-1 font-medium text-emerald-600 dark:text-emerald-400">
                  (save {{ getSavingsPercent(plan) }}%)
                </span>
              </p>
            </div>
          </div>

          <!-- Features -->
          <ul class="mb-5 flex-1 space-y-2.5">
            <li
              v-for="(feature, index) in plan.features"
              :key="index"
              class="flex items-start gap-2 text-sm"
            >
              <div class="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <Icon name="lucide:check" class="h-2.5 w-2.5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <span class="text-muted-foreground">{{ feature }}</span>
            </li>
          </ul>

          <!-- CTA Button -->
          <Button
            :variant="plan.recommended ? 'default' : 'outline'"
            :disabled="plan.id === currentPlanId || isLoading !== null"
            :class="[
              'w-full transition-all',
              plan.recommended && 'shadow-md shadow-primary/25',
            ]"
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
              Switch Plan
            </template>
            <template v-else>
              Get Started
            </template>
          </Button>
        </div>
      </div>

      <!-- Footer -->
      <div class="border-t bg-muted/30 px-6 py-4 text-center">
        <p class="text-xs text-muted-foreground">
          All plans include a 14-day free trial. Cancel anytime.
        </p>
      </div>
    </DialogContent>
  </Dialog>
</template>
