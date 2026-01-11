export interface FaqItem {
  question: string
  answer: string
}

export interface FaqCategory {
  title: string
  color: string
  items: FaqItem[]
}

export const generalFaqs: FaqItem[] = [
  {
    question: 'How is Launch different from other deployment platforms?',
    answer:
      'Launch is designed to simplify the deployment process with a user-friendly interface, allowing developers to deploy applications seamlessly across multiple cloud environments. Unlike traditional platforms, Launch focuses on automation and integration, making it ideal for both beginners and experienced developers.',
  },
  {
    question: 'Can I cancel my plan at any time?',
    answer:
      "Yes, you can cancel your plan at any time, but you'll still be responsible for the remainder of the billing term for the plan you signed up for.",
  },
  {
    question: 'What support options are available for Launch users?',
    answer:
      'Launch provides 24/7 support through email, chat, and a dedicated support portal. Our team is ready to assist you with any technical issues or questions you may have.',
  },
  {
    question: 'Can my clients or coworkers collaborate on projects?',
    answer:
      'Absolutely! You can invite clients or team members to collaborate on your projects, allowing them to upload content and manage deployments together.',
  },
  {
    question: 'How does Launch handle high traffic volumes?',
    answer:
      'Launch is built to scale effortlessly, accommodating high traffic loads with automated scaling features that ensure your applications perform optimally under pressure.',
  },
  {
    question: 'Are Launch deployments secure?',
    answer:
      'Yes, security is a priority at Launch. We implement best practices such as SSH key authentication, automated security updates, and the option for two-factor authentication to protect your data and applications.',
  },
  {
    question: 'What kind of integrations does Launch support?',
    answer:
      'Launch supports integrations with popular version control systems like GitHub and Bitbucket, allowing for automated deployments and continuous integration workflows.',
  },
  {
    question: 'Can I deploy my application to my own cloud provider?',
    answer:
      'Yes, Launch allows you to deploy applications to your own cloud accounts (AWS, GCP, Azure, etc.) or use our managed cloud services, giving you flexibility and control over your infrastructure.',
  },
  {
    question: 'Does Launch provide monitoring and analytics?',
    answer:
      'Yes, Launch includes built-in monitoring tools that provide real-time insights into your application performance, resource usage, and server health, helping you to proactively manage your deployments.',
  },
  {
    question: 'Is Launch suitable for large organizations?',
    answer:
      'Definitely! Launch is designed to cater to both small businesses and large enterprises, offering robust features that support complex deployments and team collaboration.',
  },
]

export const categorizedFaqs: FaqCategory[] = [
  {
    title: 'Getting Started',
    color: 'bg-emerald-400',
    items: [
      {
        question: 'Getting started with Launch',
        answer:
          'Launch is designed to be user-friendly and intuitive. Simply connect your server provider, link your Git repository, and deploy. Our platform auto-detects your framework and handles the rest.',
      },
      {
        question: "I'm unable to verify my account",
        answer:
          'Check your email inbox and spam folder for verification emails from us. If you still encounter issues, contact our support team for assistance.',
      },
      {
        question: 'What server providers do you support?',
        answer:
          'We support AWS, DigitalOcean, Hetzner, Vultr, Linode, and any custom server with SSH access. You can also bring your own server.',
      },
    ],
  },
  {
    title: 'Billing & Plans',
    color: 'bg-cyan-400',
    items: [
      {
        question: 'Promotional and free plan trials',
        answer:
          'Yes! You can try any of our plans risk-free for 14 days. No credit card required. Cancel anytime before the trial ends to avoid charges.',
      },
      {
        question: 'How to report an unrecognized charge',
        answer:
          "Contact our support team with your order number and a detailed description of the issue. We'll assist you in resolving the problem within 24 hours.",
      },
      {
        question: 'Cancel my subscription',
        answer:
          'To cancel your subscription, simply log in to your account, go to Settings, and click on "Cancel Subscription". Your access will continue until the end of your billing period.',
      },
    ],
  },
  {
    title: 'Account Management',
    color: 'bg-violet-400',
    items: [
      {
        question: 'Can I change my plan?',
        answer:
          'Upgrading or downgrading plans is easy! Just go to your account settings, select the new plan, and follow the prompts. Changes take effect immediately.',
      },
      {
        question: 'I am unable to edit my profile',
        answer:
          'Try clearing your browser cache or using a different browser. If the issue persists, contact our support team for assistance.',
      },
      {
        question: 'How to delete my account',
        answer:
          'To delete your account, log in to your Launch dashboard, go to Settings, and select "Delete Account". Please note this action is irreversible.',
      },
    ],
  },
]
