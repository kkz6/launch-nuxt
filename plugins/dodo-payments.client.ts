import { DodoPayments } from 'dodopayments-checkout'
import type { CheckoutEvent } from 'dodopayments-checkout'

let currentEventHandler: ((event: CheckoutEvent) => void) | null = null

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const isTestMode = config.public.apiBase?.includes('localhost') || config.public.apiBase?.includes('127.0.0.1')

  DodoPayments.Initialize({
    mode: isTestMode ? 'test' : 'live',
    displayType: 'overlay',
    onEvent: (event: CheckoutEvent) => {
      if (currentEventHandler) {
        currentEventHandler(event)
      }
    },
  })

  return {
    provide: {
      dodoCheckout: {
        open: (checkoutUrl: string, onEvent?: (event: CheckoutEvent) => void) => {
          currentEventHandler = onEvent || null
          DodoPayments.Checkout.open({
            checkoutUrl,
            options: {
              manualRedirect: !!onEvent,
            },
          })
        },
        close: () => DodoPayments.Checkout.close(),
        isOpen: () => DodoPayments.Checkout.isOpen(),
      },
    },
  }
})
