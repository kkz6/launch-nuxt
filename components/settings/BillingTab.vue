<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Progress } from '~/components/ui/progress'

interface SubscriptionPlanOptions {
  max_servers: number
  max_sites_per_server: number
  max_deployments_per_site: number
  max_team_members: number
  has_backups: boolean
  has_monitoring: boolean
}

interface SubscriptionPlan {
  id: string
  name: string
  description: string
  monthly_id: string
  yearly_id: string
  monthly_pricing: number
  yearly_pricing: number
  features: string[]
  recommended?: boolean
  options?: SubscriptionPlanOptions
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
  ordered_at: string
  discount: number
  subtotal: number
  total: number
  tax: number
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

interface BillingData {
  subscription_plans: SubscriptionPlan[]
  subscriptions: Subscription[]
  server_count: number
  receipts: Receipt[]
}

const fetchBillingData = async () => {
  try {
    const response = await $api<{ data: BillingData } | BillingData>('/billing')
    // Handle both { data: {...} } and direct response formats
    const data = 'data' in response && response.data && typeof response.data === 'object' && 'subscription_plans' in response.data
      ? response.data
      : response as BillingData
    subscriptionPlans.value = data.subscription_plans || []
    subscriptions.value = data.subscriptions || []
    serverCount.value = data.server_count || 0
    receipts.value = data.receipts || []
  } catch {
    toast.error('Failed to load billing information')
  } finally {
    isLoading.value = false
  }
}

const handleCheckout = async (planId: string, isAnnual: boolean) => {
  try {
    const data = await $api<{ url: string }>('/billing/generate-checkout-url', {
      method: 'POST',
      body: { annual: isAnnual, plan: planId },
    })
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
  if (window.createLemonSqueezy) {
    window.createLemonSqueezy()
  }
})

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
  <div class="space-y-4">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div>
      <h3 class="font-medium">Subscription</h3>
      <p class="text-sm text-muted-foreground">Manage your subscription and billing</p>
    </div>

    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Current Subscription -->
      <div class="rounded-lg border p-4">
        <div class="space-y-4">
          <!-- Ending warning -->
          <div v-if="hasSubscription && isEnding" class="space-y-3">
            <h4 class="font-medium">Subscription Ending</h4>
            <p class="text-sm text-muted-foreground">
              Your subscription will end on {{ currentSubscription?.ends_at }}.
            </p>
            <Button variant="secondary" size="sm" @click="resumeSubscription">
              Resume Subscription
            </Button>
          </div>

          <!-- Max servers warning -->
          <div
            v-if="hasSubscription && isAtMaxServers"
            class="flex items-center gap-3 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-950"
          >
            <Icon name="lucide:alert-triangle" class="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            <span class="text-sm text-yellow-600 dark:text-yellow-400">
              Maximum servers reached for your plan.
            </span>
          </div>

          <!-- Active subscription -->
          <template v-if="hasSubscription && !isEnding">
            <div class="flex items-center gap-2">
              <h4 class="font-medium">{{ currentSubscription?.plan?.name }}</h4>
              <span class="text-sm text-muted-foreground">
                ({{ currentSubscription?.yearly ? 'Annual' : 'Monthly' }})
              </span>
            </div>

            <ul class="space-y-1">
              <li
                v-for="feature in currentSubscription?.plan?.features"
                :key="feature"
                class="flex items-center text-sm text-muted-foreground"
              >
                <Icon name="lucide:check" class="mr-2 h-4 w-4 text-primary" />
                {{ feature }}
              </li>
            </ul>

            <div class="space-y-2">
              <p class="text-sm text-muted-foreground">
                {{ serverCount }} of {{ maxServers }} servers used
              </p>
              <Progress :model-value="percentage" class="h-2" />
            </div>

            <div class="flex gap-2 pt-2">
              <Button variant="secondary" size="sm" @click="isModalOpen = true">
                <Icon name="lucide:sparkles" class="mr-1 h-4 w-4" />
                Change Plan
              </Button>
              <Button variant="destructive" size="sm" @click="cancelSubscription">
                Cancel
              </Button>
            </div>
          </template>

          <!-- No subscription -->
          <template v-if="!hasSubscription">
            <p class="text-sm text-muted-foreground">You don't have an active subscription.</p>
            <Button size="sm" @click="isModalOpen = true">
              <Icon name="lucide:sparkles" class="mr-1 h-4 w-4" />
              Subscribe Now
            </Button>
          </template>
        </div>
      </div>

      <!-- Payment Method -->
      <div v-if="currentSubscription?.payment_method_url" class="rounded-lg border p-4">
        <div class="space-y-2">
          <h4 class="font-medium">Payment Method</h4>
          <p v-if="currentSubscription.card_brand && currentSubscription.card_last_four" class="text-sm text-muted-foreground">
            {{ currentSubscription.card_brand }} ending in {{ currentSubscription.card_last_four }}
          </p>
          <Button variant="secondary" size="sm" @click="updatePaymentMethod">
            Update Payment Method
          </Button>
        </div>
      </div>

      <!-- Receipts -->
      <div v-if="receipts.length > 0" class="rounded-lg border p-4">
        <h4 class="mb-3 font-medium">Receipts</h4>
        <div class="space-y-2">
          <div
            v-for="receipt in receipts"
            :key="receipt.order_number"
            class="flex items-center justify-between rounded border p-3"
          >
            <div class="space-y-0.5">
              <p class="text-sm font-medium"># {{ receipt.order_number }}</p>
              <p class="text-xs text-muted-foreground">
                ${{ receipt.total.toFixed(2) }} - {{ receipt.ordered_at }}
              </p>
            </div>
            <a :href="receipt.receipt_url" target="_blank" rel="noreferrer">
              <Button variant="ghost" size="sm">
                <Icon name="lucide:external-link" class="h-4 w-4" />
              </Button>
            </a>
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
