<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Card } from '~/components/ui/card'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'

definePageMeta({
  middleware: 'auth',
})

useHead({ title: 'Billing' })

interface SubscriptionPlan {
  id: number
  name: string
  monthly_pricing: number
  yearly_pricing: number
  features: string[]
  recommended?: boolean
  options?: {
    max_servers: number
  }
}

interface Subscription {
  id: string
  plan?: SubscriptionPlan
  yearly: boolean
  ends_at?: string
  card_brand?: string
  card_last_four?: string
  payment_method_url?: string
}

interface Receipt {
  order_number: string
  total: string
  ordered_at: string
  receipt_url: string
}

const subscriptionPlans = ref<SubscriptionPlan[]>([])
const subscriptions = ref<Subscription[]>([])
const serverCount = ref(0)
const receipts = ref<Receipt[]>([])
const isLoading = ref(true)
const isModalOpen = ref(false)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const currentSubscription = computed(() =>
  subscriptions.value.length > 0 ? subscriptions.value[0] : null
)

const maxServers = computed(() => currentSubscription.value?.plan?.options?.max_servers ?? 1)

const percentage = computed(() =>
  Math.min((serverCount.value / maxServers.value) * 100, 100)
)

const hasSubscription = computed(() => subscriptions.value.length > 0)
const isEnding = computed(() => Boolean(currentSubscription.value?.ends_at))
const isAtMaxServers = computed(() => serverCount.value === maxServers.value)

const fetchBillingData = async () => {
  try {
    const data = await $api<{
      subscription_plans: SubscriptionPlan[]
      subscriptions: Subscription[]
      server_count: number
      receipts: Receipt[]
    }>('/billing')
    subscriptionPlans.value = data.subscription_plans
    subscriptions.value = data.subscriptions
    serverCount.value = data.server_count
    receipts.value = data.receipts || []
  } catch {
    toast.error('Failed to load billing information')
  } finally {
    isLoading.value = false
  }
}

const handleCheckout = async (planId: number, isAnnual: boolean) => {
  try {
    const data = await $api<{ url: string }>('/billing/generate-checkout-url', {
      method: 'POST',
      body: { annual: isAnnual, plan: planId },
    })
    // Open Lemon Squeezy checkout
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(data.url)
    } else {
      window.open(data.url, '_blank')
    }
    isModalOpen.value = false
  } catch {
    toast.error('Failed to generate checkout URL')
  }
}

const cancelSubscription = async () => {
  if (!confirmationDialog.value || !currentSubscription.value) return

  const result = await confirmationDialog.value.show({
    title: `Cancel ${currentSubscription.value.plan?.name || 'Subscription'}`,
    description: 'Are you sure you want to cancel your subscription? You will lose access to all features at the end of your billing period.',
    confirmText: 'Cancel Subscription',
    cancelText: 'Keep Subscription',
    destructive: true,
  })

  if (result.ok) {
    try {
      await $api('/billing/cancel-subscription', {
        method: 'POST',
        body: { subscription: currentSubscription.value.id },
      })
      toast.success('Subscription cancelled')
      fetchBillingData()
    } catch {
      toast.error('Failed to cancel subscription')
    }
  }
}

const resumeSubscription = async () => {
  if (!confirmationDialog.value || !currentSubscription.value) return

  const result = await confirmationDialog.value.show({
    title: `Resume ${currentSubscription.value.plan?.name || 'Subscription'}`,
    description: 'Would you like to resume your subscription?',
    confirmText: 'Resume Subscription',
    cancelText: 'Cancel',
  })

  if (result.ok) {
    try {
      await $api('/billing/resume-subscription', {
        method: 'POST',
        body: { subscription: currentSubscription.value.id },
      })
      toast.success('Subscription resumed')
      fetchBillingData()
    } catch {
      toast.error('Failed to resume subscription')
    }
  }
}

const updatePaymentMethod = () => {
  if (currentSubscription.value?.payment_method_url) {
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(currentSubscription.value.payment_method_url)
    } else {
      window.open(currentSubscription.value.payment_method_url, '_blank')
    }
  }
}

onMounted(() => {
  fetchBillingData()
  // Initialize Lemon Squeezy
  if (window.createLemonSqueezy) {
    window.createLemonSqueezy()
  }
})

// TypeScript declarations for Lemon Squeezy
declare global {
  interface Window {
    LemonSqueezy?: {
      Url: {
        Open: (url: string) => void
      }
    }
    createLemonSqueezy?: () => void
  }
}
</script>

<template>
  <div class="space-y-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div>
      <h1 class="text-2xl font-bold">Subscription</h1>
      <p class="text-muted-foreground">Manage your subscription and billing settings</p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-8 w-8 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Current Subscription -->
      <div class="rounded-lg border bg-background p-6 shadow-sm">
        <div class="space-y-4">
          <!-- Ending warning -->
          <div v-if="hasSubscription && isEnding" class="space-y-4">
            <h3 class="text-lg font-medium">Subscription Ending</h3>
            <p class="text-muted-foreground">
              Your subscription will end on {{ currentSubscription?.ends_at }}.
            </p>
            <Button variant="secondary" @click="resumeSubscription">
              Resume Subscription
            </Button>
          </div>

          <!-- Max servers warning -->
          <div
            v-if="hasSubscription && isAtMaxServers"
            class="flex items-center gap-4 rounded-lg bg-yellow-50 p-2 dark:bg-yellow-950"
          >
            <Icon name="lucide:alert-triangle" class="text-yellow-600 dark:text-yellow-400" />
            <span class="text-sm text-yellow-600 dark:text-yellow-400">
              You have reached the maximum number of servers for your plan.
            </span>
          </div>

          <!-- Active subscription -->
          <template v-if="hasSubscription && !isEnding">
            <h3 class="text-lg font-medium">
              {{ currentSubscription?.plan?.name }}
              <span class="text-muted-foreground">
                ({{ currentSubscription?.yearly ? 'Annual' : 'Monthly' }})
              </span>
            </h3>

            <ul role="list" class="flex flex-col gap-y-2 text-sm">
              <li
                v-for="feature in currentSubscription?.plan?.features"
                :key="feature"
                class="flex text-muted-foreground"
              >
                <Icon name="lucide:check" class="mr-2 h-4 w-4 text-primary" />
                <span>{{ feature }}</span>
              </li>
            </ul>

            <p class="text-sm text-muted-foreground">
              {{ serverCount }} of {{ maxServers }} servers used
            </p>

            <div class="pb-5">
              <Progress :model-value="percentage" class="max-w-lg" />
            </div>

            <div class="flex gap-x-2">
              <Button variant="secondary" @click="isModalOpen = true">
                <Icon name="lucide:sparkles" class="mr-2 h-4 w-4" />
                Change Plan
              </Button>
              <Button variant="destructive" @click="cancelSubscription">
                Cancel Subscription
              </Button>
            </div>
          </template>

          <!-- No subscription -->
          <template v-if="!hasSubscription">
            <p class="text-muted-foreground">You don't have an active subscription.</p>
            <Button @click="isModalOpen = true">
              <Icon name="lucide:sparkles" class="mr-2 h-4 w-4" />
              Subscribe Now
            </Button>
          </template>
        </div>
      </div>

      <!-- Payment Method -->
      <div
        v-if="currentSubscription?.payment_method_url"
        class="rounded-lg border bg-background p-6 shadow-sm"
      >
        <div class="space-y-2">
          <h2 class="text-2xl font-bold">Payment Method</h2>
          <p class="text-muted-foreground">
            <span v-if="currentSubscription.card_brand && currentSubscription.card_last_four">
              {{ currentSubscription.card_brand }} ending in {{ currentSubscription.card_last_four }}
            </span>
          </p>
          <Button variant="secondary" @click="updatePaymentMethod">
            Update Payment Method
          </Button>
        </div>
      </div>

      <!-- Receipts -->
      <div
        v-if="receipts.length > 0"
        class="rounded-lg border bg-background p-6 shadow-sm"
      >
        <div class="space-y-4">
          <h2 class="text-2xl font-bold">Receipts</h2>

          <div v-for="receipt in receipts" :key="receipt.order_number" class="space-y-4">
            <Card class="flex h-full flex-col items-center justify-between bg-transparent p-4 sm:flex-row max-sm:gap-2">
              <div class="flex w-full items-center space-x-4">
                <div class="flex flex-col gap-1">
                  <p class="font-medium"># {{ receipt.order_number }}</p>
                  <p class="text-sm text-muted-foreground">{{ receipt.total }}</p>
                  <p class="text-sm text-muted-foreground">
                    Ordered at {{ receipt.ordered_at }}
                  </p>
                </div>
              </div>
              <div class="flex flex-col sm:flex-row sm:gap-4">
                <a :href="receipt.receipt_url" target="_blank" rel="noreferrer">
                  <Button variant="outline">
                    <Icon name="lucide:link" class="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </template>

    <BillingPricingModal
      v-model:is-open="isModalOpen"
      :plans="subscriptionPlans"
      :current-plan-id="currentSubscription?.plan?.id"
      @select-plan="handleCheckout"
    />
  </div>
</template>
