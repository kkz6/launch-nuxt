<script setup lang="ts">
definePageMeta({ layout: 'site' })

useHead({ title: 'Refund Policy' })
useSeoMeta({
  description:
    'launchctl offers no-questions-asked refunds. Not happy in your first 30 days? Email us and we refund your subscription in full.',
})
</script>

<template>
  <LegalDoc
    title="Refund Policy"
    updated="11 June 2026"
    intro="We keep this simple. If launchctl isn't working out for you, we'll refund you — no questions asked."
  >
    <p class="lead">
      <strong>Not happy? We refund you.</strong> Within 30 days of any
      subscription payment, email us and we'll refund it in full — no forms, no
      hoops, no "why are you leaving?" interrogation.
    </p>

    <h2>How to request a refund</h2>
    <p>
      Email <a href="mailto:support@launchctl.io">support@launchctl.io</a> from
      the address on your account, or use our
      <NuxtLink to="/support">contact form</NuxtLink>. Tell us which charge you'd
      like refunded — that's it. You don't need to give a reason.
    </p>

    <h2>What's covered</h2>
    <ul>
      <li>
        <strong>Subscription payments</strong> billed by launchctl, refunded to
        your original payment method within 30 days of the charge.
      </li>
      <li>Refunds are issued in full — we don't pro-rate or deduct fees.</li>
      <li>
        Once refunded, the related subscription ends and paid features switch
        off. Your servers and data are untouched — they live on your own cloud.
      </li>
    </ul>

    <h2>What we can't refund</h2>
    <p>
      launchctl runs your apps on infrastructure <strong>you own</strong>, so any
      charges from your cloud provider (DigitalOcean, Hetzner, AWS, Linode,
      Vultr and the like) are billed directly by them, not by us. We can't refund
      those — please raise them with your provider.
    </p>

    <h2>Beyond 30 days</h2>
    <p>
      Outside the 30-day window we're still happy to talk. You can cancel any
      time to stop future charges, and if something went genuinely wrong, reach
      out — we'll do the right thing.
    </p>

    <h2>Questions</h2>
    <p>
      Anything unclear? We're at
      <a href="mailto:support@launchctl.io">support@launchctl.io</a> and usually
      reply within a business day.
    </p>
  </LegalDoc>
</template>
