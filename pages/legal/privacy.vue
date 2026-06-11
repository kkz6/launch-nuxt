<script setup lang="ts">
definePageMeta({ layout: 'site' })

useHead({ title: 'Privacy Policy' })
useSeoMeta({
  description:
    'How launchctl (Gigcodes) collects, uses and protects your data. Your apps and data run on infrastructure you own.',
})
</script>

<template>
  <LegalDoc
    title="Privacy Policy"
    updated="11 June 2026"
    intro="This policy explains what data launchctl collects, why, and the choices you have. launchctl is operated by Gigcodes (&ldquo;we&rdquo;, &ldquo;us&rdquo;)."
  >
    <h2>1. Who we are</h2>
    <p>
      launchctl is a server-management and deployment platform operated by
      Gigcodes. We help you provision servers on your own cloud accounts and
      deploy and operate applications on them. This policy covers the launchctl
      website, dashboard and API.
    </p>

    <h2>2. Information we collect</h2>
    <ul>
      <li>
        <strong>Account information</strong> — your name, email address and a
        securely hashed password when you sign up, plus team membership details.
      </li>
      <li>
        <strong>Billing information</strong> — subscriptions are processed by our
        payment provider, Polar. We receive your plan, subscription status and
        invoices, but <strong>we never see or store full card numbers</strong>.
      </li>
      <li>
        <strong>Infrastructure credentials</strong> — cloud-provider API tokens,
        SSH keys and connection details you add so we can provision and operate
        your servers. These are encrypted and used only to run the features you
        enable.
      </li>
      <li>
        <strong>Usage &amp; diagnostic data</strong> — logs, IP address, browser
        type and actions taken in the product, used to operate the service and
        debug issues.
      </li>
      <li>
        <strong>Communications</strong> — messages you send us via support or the
        contact form.
      </li>
    </ul>

    <h2>3. How we use your information</h2>
    <ul>
      <li>To provide, operate and secure the launchctl platform.</li>
      <li>To process subscriptions, billing and refunds.</li>
      <li>To provide support and respond to your requests.</li>
      <li>To monitor reliability, prevent abuse and improve the product.</li>
      <li>To meet legal and regulatory obligations.</li>
    </ul>
    <p>We do not sell your personal data, and we never have.</p>

    <h2>4. Your apps and data stay yours</h2>
    <p>
      The applications, databases and content you deploy run on servers in
      <strong>your own cloud accounts</strong>. We access your infrastructure
      only to perform the actions you ask of us — provisioning, deploying,
      streaming logs, running backups and similar. That data is yours, not ours.
    </p>

    <h2>5. Who we share it with</h2>
    <p>We share data only with the providers needed to run the service:</p>
    <ul>
      <li><strong>Polar</strong> — subscription billing and payments.</li>
      <li>
        <strong>Cloud providers you connect</strong> (e.g. DigitalOcean, Hetzner,
        AWS, Linode, Vultr) and <strong>GitHub</strong> for CI/CD, acting on your
        instructions.
      </li>
      <li>
        <strong>Infrastructure and email providers</strong> we use to host
        launchctl and send transactional email.
      </li>
      <li>
        <strong>Authorities</strong>, where required by law or to protect our
        rights and users.
      </li>
    </ul>

    <h2>6. Data retention</h2>
    <p>
      We keep your information for as long as your account is active. When you
      close your account or ask us to delete your data, we remove it within a
      reasonable period, except where we must retain certain records (for
      example, invoices) to meet legal obligations.
    </p>

    <h2>7. Security</h2>
    <p>
      We protect data in transit with TLS and encrypt sensitive secrets such as
      cloud tokens and SSH keys at rest. Access is restricted to what's needed to
      operate the service. No system is perfectly secure, but we work hard to
      keep yours safe.
    </p>

    <h2>8. Your rights</h2>
    <p>
      You can access, correct, export or delete your personal data at any time —
      from your account settings or by emailing us. We'll respond within a
      reasonable timeframe.
    </p>

    <h2>9. Cookies</h2>
    <p>
      We use essential cookies to keep you signed in and to remember preferences
      such as light/dark mode. We don't use them to track you across other sites.
    </p>

    <h2>10. Changes to this policy</h2>
    <p>
      We may update this policy from time to time. We'll revise the &ldquo;last
      updated&rdquo; date above and, for material changes, notify you in the
      product or by email.
    </p>

    <h2>11. Contact</h2>
    <p>
      Questions about your privacy? Email
      <a href="mailto:support@launchctl.io">support@launchctl.io</a> or use our
      <NuxtLink to="/support">contact form</NuxtLink>.
    </p>
  </LegalDoc>
</template>
