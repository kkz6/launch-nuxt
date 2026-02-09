import { DodoPayments } from 'dodopayments-checkout'

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  const isTestMode = config.public.apiBase?.includes('localhost') || config.public.apiBase?.includes('127.0.0.1')

  DodoPayments.Initialize({
    mode: isTestMode ? 'test' : 'live',
    displayType: 'redirect',
  })

  return {
    provide: {
      dodoCheckout: {
        open: (checkoutUrl: string) => {
          DodoPayments.Checkout.open({ checkoutUrl })
        },
      },
    },
  }
})
