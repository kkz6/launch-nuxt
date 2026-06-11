<script setup lang="ts">
definePageMeta({ layout: 'site' })

useHead({ title: 'Terms of Service' })
useSeoMeta({
  description:
    'The terms that govern your use of launchctl, operated by Gigcodes — accounts, billing, acceptable use and your responsibilities.',
})
</script>

<template>
  <LegalDoc
    title="Terms of Service"
    updated="11 June 2026"
    intro="These terms govern your use of launchctl, operated by Gigcodes. By creating an account or using the service, you agree to them."
  >
    <h2>1. The service</h2>
    <p>
      launchctl is a platform that provisions servers on cloud accounts you
      connect and helps you deploy and operate applications — Laravel and PHP
      apps, Docker stacks, managed databases and related tooling such as CI/CD,
      logs, queues, backups and SSL. We provide the control plane; the
      infrastructure runs on your own cloud.
    </p>

    <h2>2. Your account</h2>
    <ul>
      <li>You must provide accurate information and keep it up to date.</li>
      <li>
        You're responsible for activity under your account and for keeping your
        credentials secure.
      </li>
      <li>You must be at least 16 and able to enter into a contract.</li>
    </ul>

    <h2>3. Your infrastructure and responsibilities</h2>
    <p>
      Because your servers and applications run on cloud accounts you own, you
      are responsible for:
    </p>
    <ul>
      <li>
        The applications, data and content you deploy, and having the right to
        use them.
      </li>
      <li>
        Any charges your cloud provider bills you directly — these are separate
        from your launchctl subscription.
      </li>
      <li>
        Complying with the terms of the cloud providers and third-party services
        you connect.
      </li>
    </ul>

    <h2>4. Acceptable use</h2>
    <p>You agree not to use launchctl to:</p>
    <ul>
      <li>Break the law or infringe others' rights.</li>
      <li>
        Host or distribute malware, or attack, probe or disrupt systems you
        don't own or aren't authorised to test.
      </li>
      <li>
        Interfere with or abuse the launchctl platform, or attempt to bypass its
        security or usage limits.
      </li>
    </ul>

    <h2>5. Billing and subscriptions</h2>
    <ul>
      <li>
        Paid plans are billed in advance through our payment provider, Polar, and
        renew automatically until cancelled.
      </li>
      <li>
        You can cancel any time from your account; cancellation stops future
        charges and takes effect at the end of the current period.
      </li>
      <li>Prices may exclude taxes, which are added where required.</li>
      <li>
        Refunds are handled under our
        <NuxtLink to="/legal/refund">Refund Policy</NuxtLink> — no questions
        asked within 30 days.
      </li>
    </ul>

    <h2>6. Third-party services</h2>
    <p>
      launchctl works with services you connect, such as your cloud providers,
      GitHub and Polar. We're not responsible for those services or their
      availability, and your use of them is governed by their own terms.
    </p>

    <h2>7. Intellectual property</h2>
    <p>
      We own the launchctl platform, software and brand. You keep all rights to
      the applications, data and content you deploy. You grant us only the access
      needed to operate the features you enable.
    </p>

    <h2>8. Disclaimers</h2>
    <p>
      launchctl is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;.
      To the fullest extent permitted by law, we disclaim all warranties, express
      or implied, including fitness for a particular purpose. You're responsible
      for maintaining your own backups and for the resilience of your
      infrastructure.
    </p>

    <h2>9. Limitation of liability</h2>
    <p>
      To the fullest extent permitted by law, Gigcodes will not be liable for any
      indirect, incidental or consequential damages, or for loss of data, profits
      or revenue. Our total liability for any claim relating to the service is
      limited to the amount you paid us for it in the 12 months before the claim.
    </p>

    <h2>10. Termination</h2>
    <p>
      You can stop using launchctl and close your account at any time. We may
      suspend or terminate access if you breach these terms or use the service in
      a way that risks harm to others or to the platform. Your servers and data
      remain on your own cloud.
    </p>

    <h2>11. Changes</h2>
    <p>
      We may update the service and these terms. We'll revise the &ldquo;last
      updated&rdquo; date above and, for material changes, give reasonable notice.
      Continuing to use launchctl after changes means you accept them.
    </p>

    <h2>12. Governing law</h2>
    <p>
      These terms are governed by the laws of the jurisdiction in which Gigcodes
      is established, without regard to conflict-of-law principles.
    </p>

    <h2>13. Contact</h2>
    <p>
      Questions about these terms? Email
      <a href="mailto:support@launchctl.io">support@launchctl.io</a> or use our
      <NuxtLink to="/support">contact form</NuxtLink>.
    </p>
  </LegalDoc>
</template>
