<script setup lang="ts">
import { toast } from 'vue-sonner'
import { Button } from '~/components/ui/button'
import { Badge } from '~/components/ui/badge'

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
  status?: string
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

const hasSubscription = computed(() => subscriptions.value.length > 0)
const isEnding = computed(() => Boolean(currentSubscription.value?.ends_at))

// Format price from cents to dollars
const formatPrice = (cents: number) => (cents / 100).toFixed(2)

const fetchBillingData = async () => {
  try {
    const response = await $api<{
      data: {
        subscription_plans: SubscriptionPlan[]
        subscriptions: Subscription[]
        server_count: number
        receipts: Receipt[]
      }
    }>('/billing')
    const data = response.data
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
    const response = await $api<{ data: { url: string } }>('/billing/generate-checkout-url', {
      method: 'POST',
      body: { annual: isAnnual, plan: planId },
    })
    const url = response.data?.url || (response as any).url
    if (window.LemonSqueezy) {
      window.LemonSqueezy.Url.Open(url)
    } else {
      window.open(url, '_blank')
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
  <div class="space-y-8">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Subscription Section -->
      <div class="space-y-4">
        <div class="border-l-2 border-primary pl-4">
          <h3 class="text-lg font-semibold">Subscription</h3>
        </div>

        <!-- Active Subscription Card -->
        <div v-if="hasSubscription" class="rounded-xl border bg-card p-5">
          <div class="flex items-start justify-between">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <h4 class="text-lg font-semibold">{{ currentSubscription?.plan?.name }}</h4>
                <Badge v-if="isEnding" variant="destructive" class="text-xs">
                  Ending
                </Badge>
                <Badge v-else variant="secondary" class="text-xs">
                  {{ currentSubscription?.yearly ? 'Annual' : 'Monthly' }}
                </Badge>
              </div>
              <p class="text-sm text-muted-foreground">
                ${{ formatPrice(currentSubscription?.yearly ? currentSubscription?.plan?.yearly_pricing || 0 : currentSubscription?.plan?.monthly_pricing || 0) }}/{{ currentSubscription?.yearly ? 'year' : 'mo' }}
                <span v-if="currentSubscription?.plan?.options?.max_servers">
                  - includes {{ currentSubscription.plan.options.max_servers === 999999 ? 'unlimited' : currentSubscription.plan.options.max_servers }} servers
                </span>
              </p>
              <p v-if="isEnding" class="text-sm text-destructive">
                Your subscription will end on {{ currentSubscription?.ends_at }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <Button v-if="isEnding" size="sm" @click="resumeSubscription">
                Resume
              </Button>
              <button
                class="text-sm font-medium text-primary hover:underline"
                @click="isModalOpen = true"
              >
                Change plan
              </button>
            </div>
          </div>
        </div>

        <!-- No Subscription Card -->
        <div v-else class="rounded-xl border bg-card p-5">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <h4 class="font-medium text-muted-foreground">No active subscription</h4>
              <p class="text-sm text-muted-foreground">
                Subscribe to unlock all features
              </p>
            </div>
            <Button @click="isModalOpen = true">
              Subscribe Now
            </Button>
          </div>
        </div>
      </div>

      <!-- Payment Method Section -->
      <div v-if="hasSubscription" class="space-y-4">
        <div class="border-l-2 border-primary pl-4">
          <h3 class="text-lg font-semibold">Payment Method</h3>
        </div>

        <div class="rounded-xl border bg-card p-5">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                <Icon name="lucide:credit-card" class="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-medium">
                    {{ currentSubscription?.card_brand || 'Card' }}
                  </span>
                  <Badge v-if="currentSubscription?.card_last_four" variant="outline" class="text-xs">
                    Default
                  </Badge>
                </div>
                <p v-if="currentSubscription?.card_last_four" class="text-sm text-muted-foreground">
                  **** **** **** {{ currentSubscription.card_last_four }}
                </p>
              </div>
            </div>
            <Button
              v-if="currentSubscription?.payment_method_url"
              variant="default"
              @click="updatePaymentMethod"
            >
              Update payment method
            </Button>
          </div>
        </div>
      </div>

      <!-- Billing History Section -->
      <div v-if="receipts.length > 0" class="space-y-4">
        <div class="border-l-2 border-primary pl-4">
          <h3 class="text-lg font-semibold">Billing History</h3>
        </div>

        <div class="rounded-xl border bg-card">
          <div class="divide-y">
            <div
              v-for="receipt in receipts"
              :key="receipt.order_number"
              class="flex items-center justify-between p-4"
            >
              <div class="flex items-center gap-4">
                <div class="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon name="lucide:receipt" class="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p class="font-medium">Invoice #{{ receipt.order_number }}</p>
                  <p class="text-sm text-muted-foreground">{{ receipt.ordered_at }}</p>
                </div>
              </div>
              <div class="flex items-center gap-4">
                <div class="text-right">
                  <p class="font-medium">${{ receipt.total }}</p>
                  <p v-if="receipt.discount > 0" class="text-xs text-emerald-600">
                    Saved ${{ receipt.discount }}
                  </p>
                </div>
                <a :href="receipt.receipt_url" target="_blank" rel="noreferrer">
                  <Button variant="ghost" size="icon">
                    <Icon name="lucide:external-link" class="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div v-if="hasSubscription && !isEnding" class="space-y-4">
        <div class="border-l-2 border-destructive pl-4">
          <h3 class="text-lg font-semibold">Danger Zone</h3>
        </div>

        <div class="rounded-xl border border-destructive/20 bg-destructive/5 p-5">
          <div class="flex items-center justify-between">
            <div class="space-y-1">
              <h4 class="font-medium">Cancel Subscription</h4>
              <p class="text-sm text-muted-foreground">
                Cancel your subscription. You'll retain access until the end of your billing period.
              </p>
            </div>
            <Button variant="destructive" @click="cancelSubscription">
              Cancel Subscription
            </Button>
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
