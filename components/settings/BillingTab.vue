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
  currency: string
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
const pricingModal = ref<{ resetLoading: () => void } | null>(null)
const confirmationDialog = ref<InstanceType<typeof import('~/components/shared/ConfirmationDialog.vue').default> | null>(null)

const currentSubscription = computed(() =>
  subscriptions.value.length > 0 ? subscriptions.value[0] : null
)

const hasSubscription = computed(() => subscriptions.value.length > 0)
const isEnding = computed(() => Boolean(currentSubscription.value?.ends_at))

// Format price from cents to dollars
const formatPrice = (cents: number) => (cents / 100).toFixed(2)

// Format currency amount with symbol
const formatCurrency = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)}`
  }
}

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

const nuxtApp = useNuxtApp()
const dodoCheckout = nuxtApp.$dodoCheckout as {
  open: (url: string) => void
} | undefined

const handleCheckout = async (planId: string, isAnnual: boolean) => {
  try {
    const response = await $api<{ data: { url: string } }>('/billing/generate-checkout-url', {
      method: 'POST',
      body: { annual: isAnnual, plan: planId },
    })
    const url = response.data?.url || (response as any).url
    isModalOpen.value = false

    if (dodoCheckout) {
      dodoCheckout.open(url)
    } else {
      window.location.href = url
    }
  } catch (error: unknown) {
    const errorData = error as { data?: { message?: string } }
    const message = errorData?.data?.message || 'Failed to generate checkout URL'
    toast.error(message)
    pricingModal.value?.resetLoading()
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
    window.open(currentSubscription.value.payment_method_url, '_blank')
  }
}

onMounted(() => {
  fetchBillingData()
})
</script>

<template>
  <div class="space-y-6 px-6">
    <SharedConfirmationDialog ref="confirmationDialog" />

    <div v-if="isLoading" class="flex items-center justify-center py-12">
      <Icon name="lucide:loader-2" class="h-6 w-6 animate-spin text-muted-foreground" />
    </div>

    <template v-else>
      <!-- Subscription Card -->
      <div class="overflow-hidden rounded-xl border bg-card">
        <!-- Active Subscription -->
        <template v-if="hasSubscription">
          <!-- Top Section -->
          <div class="flex items-start justify-between border-b p-5">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your Plan</p>
              <h4 class="mt-1 text-lg font-semibold">{{ currentSubscription?.plan?.name }}</h4>
              <p class="mt-0.5 text-sm text-muted-foreground">
                <span v-if="currentSubscription?.plan?.options?.max_servers">
                  {{ currentSubscription.plan.options.max_servers === 999999 ? 'Unlimited' : currentSubscription.plan.options.max_servers }} servers
                </span>
                <span v-if="currentSubscription?.plan?.options?.max_servers"> · </span>
                {{ currentSubscription?.yearly ? 'Annual' : 'Monthly' }} billing
              </p>
            </div>
            <div class="text-right">
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Price</p>
              <p class="mt-1 text-lg font-semibold">
                ${{ formatPrice(currentSubscription?.yearly ? currentSubscription?.plan?.yearly_pricing || 0 : currentSubscription?.plan?.monthly_pricing || 0) }}
                <span class="text-sm font-normal text-muted-foreground">USD</span>
              </p>
              <p class="text-xs text-muted-foreground">
                per {{ currentSubscription?.yearly ? 'year' : 'month' }}
              </p>
            </div>
          </div>

          <!-- Payment Method Section -->
          <div v-if="currentSubscription?.card_brand && currentSubscription?.card_last_four" class="flex items-center justify-between border-b p-5">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-14 items-center justify-center rounded-md border bg-white dark:bg-muted">
                <Icon v-if="currentSubscription.card_brand.toLowerCase() === 'visa'" name="simple-icons:visa" class="h-6 w-10 text-[#1A1F71]" />
                <Icon v-else-if="currentSubscription.card_brand.toLowerCase() === 'mastercard'" name="simple-icons:mastercard" class="h-6 w-6" />
                <Icon v-else-if="currentSubscription.card_brand.toLowerCase() === 'amex' || currentSubscription.card_brand.toLowerCase() === 'american express'" name="simple-icons:americanexpress" class="h-6 w-6 text-[#006FCF]" />
                <Icon v-else-if="currentSubscription.card_brand.toLowerCase() === 'discover'" name="simple-icons:discover" class="h-6 w-6" />
                <Icon v-else name="lucide:credit-card" class="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <p class="font-medium">
                  {{ currentSubscription.card_brand.charAt(0).toUpperCase() + currentSubscription.card_brand.slice(1) }} ending in {{ currentSubscription.card_last_four }}
                </p>
                <p class="text-xs text-muted-foreground">Default payment method</p>
              </div>
            </div>
            <Button
              v-if="currentSubscription?.payment_method_url"
              variant="outline"
              size="sm"
              @click="updatePaymentMethod"
            >
              Update
            </Button>
          </div>

          <!-- Bottom Section -->
          <div class="flex items-center justify-between p-5">
            <div class="flex items-center gap-3">
              <Badge
                v-if="isEnding"
                variant="outline"
                class="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
              >
                Ending
              </Badge>
              <Badge
                v-else
                variant="outline"
                class="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                Active
              </Badge>
              <span v-if="isEnding" class="text-sm text-muted-foreground">
                Ends on {{ currentSubscription?.ends_at }}
              </span>
              <span v-else class="text-sm text-muted-foreground">
                Renews {{ currentSubscription?.yearly ? 'annually' : 'monthly' }}
              </span>
            </div>
            <div class="flex items-center gap-2">
              <Button v-if="isEnding" variant="outline" size="sm" @click="resumeSubscription">
                <Icon name="lucide:rotate-ccw" class="mr-1.5 h-3.5 w-3.5" />
                Resume
              </Button>
              <Button variant="outline" size="sm" @click="isModalOpen = true">
                <Icon name="lucide:arrow-right-left" class="mr-1.5 h-3.5 w-3.5" />
                Change Plan
              </Button>
              <Button
                v-if="!isEnding"
                variant="ghost"
                size="sm"
                class="text-destructive hover:bg-destructive/10 hover:text-destructive"
                @click="cancelSubscription"
              >
                Cancel
              </Button>
            </div>
          </div>
        </template>

        <!-- No Subscription -->
        <template v-else>
          <div class="flex items-center justify-between p-5">
            <div>
              <p class="text-xs font-medium uppercase tracking-wide text-muted-foreground">Your Plan</p>
              <h4 class="mt-1 text-lg font-semibold text-muted-foreground">No active subscription</h4>
              <p class="mt-0.5 text-sm text-muted-foreground">
                Subscribe to unlock all features
              </p>
            </div>
            <Button @click="isModalOpen = true">
              <Icon name="lucide:sparkles" class="mr-1.5 h-4 w-4" />
              Subscribe Now
            </Button>
          </div>
        </template>
      </div>

      <!-- Invoices Section -->
      <div v-if="receipts.length > 0" class="overflow-hidden rounded-xl border bg-card">
        <div class="border-b px-5 py-4">
          <h3 class="font-semibold">Invoices</h3>
        </div>

        <!-- Table Header -->
        <div class="grid grid-cols-12 gap-4 border-b bg-muted/30 px-5 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <div class="col-span-4">Invoice</div>
          <div class="col-span-2 text-center">Status</div>
          <div class="col-span-3">Date</div>
          <div class="col-span-2 text-right">Amount</div>
          <div class="col-span-1" />
        </div>

        <!-- Table Rows -->
        <div class="divide-y">
          <div
            v-for="receipt in receipts"
            :key="receipt.order_number"
            class="grid grid-cols-12 items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/30"
          >
            <div class="col-span-4">
              <p class="font-medium">#{{ receipt.order_number }}</p>
            </div>
            <div class="col-span-2 flex justify-center">
              <Badge
                variant="outline"
                class="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400"
              >
                <Icon name="lucide:check" class="mr-1 h-3 w-3" />
                Paid
              </Badge>
            </div>
            <div class="col-span-3">
              <p class="text-sm text-muted-foreground">{{ receipt.ordered_at }}</p>
            </div>
            <div class="col-span-2 text-right">
              <p class="font-medium">
                <span v-if="receipt.discount > 0" class="mr-1.5 text-sm text-muted-foreground line-through">
                  {{ formatCurrency(receipt.total + receipt.discount, receipt.currency) }}
                </span>
                {{ formatCurrency(receipt.total, receipt.currency) }}
                <span class="text-sm font-normal text-muted-foreground">{{ receipt.currency }}</span>
              </p>
            </div>
            <div class="col-span-1 flex justify-end">
              <a :href="receipt.receipt_url" target="_blank" rel="noreferrer">
                <Button variant="ghost" size="icon" class="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <Icon name="lucide:download" class="h-4 w-4" />
                </Button>
              </a>
            </div>
          </div>
        </div>
      </div>
    </template>

    <BillingPricingModal
      ref="pricingModal"
      v-model:is-open="isModalOpen"
      :plans="subscriptionPlans"
      :current-plan-id="currentSubscription?.plan?.id"
      @select-plan="handleCheckout"
    />
  </div>
</template>
