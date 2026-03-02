const mongoose = require('mongoose');
const { MarketingPage } = require('../../models/admin');
require('dotenv').config();

/**
 * Seed Script — Create default marketing pages
 * Run: node src/scripts/seed/seedMarketingPages.js
 *
 * Creates 7 pages: Landing (homepage), Features, Pricing, Contact, Privacy, Terms, Blog
 * Each page is fully editable from the Admin Center.
 */

const defaultPages = [
  // ────────────────────────────────────────── LANDING / HOMEPAGE
  {
    title: 'Home',
    slug: 'home',
    description: 'Main landing page',
    metaTitle: 'Welcome — Your Business Starts Here',
    metaDescription: 'The all-in-one platform to grow your business. Start for free today.',
    status: 'published',
    isHomePage: true,
    showInNavigation: false,
    navigationOrder: 0,
    blocks: [
      // Hero
      {
        type: 'hero',
        title: 'Supercharge Your Business with AI',
        subtitle: 'The all-in-one platform that helps you optimize, automate, and grow. Join thousands of professionals who trust us to scale their business.',
        buttonText: 'Get Started Free',
        buttonLink: '/signup',
        secondaryButtonText: 'See How It Works',
        secondaryButtonLink: '/features',
        order: 0,
        visible: true,
      },
      // Stats
      {
        type: 'stats',
        title: 'Trusted by businesses worldwide',
        items: [
          { title: '10,000+', description: 'Active Users' },
          { title: '2M+', description: 'Tasks Automated' },
          { title: '99.9%', description: 'Uptime SLA' },
          { title: '4.9/5', description: 'User Rating' },
        ],
        order: 1,
        visible: true,
      },
      // Features overview
      {
        type: 'features',
        title: 'Everything You Need to Succeed',
        subtitle: 'Powerful features designed to save you time and maximize results.',
        items: [
          {
            title: 'AI-Powered Analytics',
            description: 'Get actionable insights from your data with our advanced AI engine. Make smarter decisions, faster.',
            icon: 'bar-chart',
          },
          {
            title: 'Smart Automation',
            description: 'Automate repetitive tasks and workflows. Focus on what matters while we handle the rest.',
            icon: 'zap',
          },
          {
            title: 'Real-time Dashboard',
            description: 'Monitor your performance in real-time with beautiful, customizable dashboards.',
            icon: 'target',
          },
          {
            title: 'Enterprise Security',
            description: 'Bank-grade encryption and security protocols to keep your data safe and compliant.',
            icon: 'shield',
          },
          {
            title: 'Team Collaboration',
            description: 'Work together seamlessly with role-based access, shared workspaces, and team analytics.',
            icon: 'users',
          },
          {
            title: '24/7 Support',
            description: 'Our dedicated support team is always here to help you succeed. Chat, email, or call anytime.',
            icon: 'message',
          },
        ],
        order: 2,
        visible: true,
      },
      // Testimonials
      {
        type: 'testimonials',
        title: 'What Our Users Say',
        subtitle: 'Don\'t just take our word for it. Here\'s what real users have to say.',
        items: [
          {
            title: 'Sarah Johnson',
            description: 'This platform completely transformed how I run my business. The AI insights alone have saved me 20 hours per week.',
            icon: 'CEO, TechStart Inc.',
            image: '',
          },
          {
            title: 'Michael Chen',
            description: 'The automation features are incredible. We\'ve increased our productivity by 300% since switching to this platform.',
            icon: 'Founder, GrowthLab',
            image: '',
          },
          {
            title: 'Emily Rodriguez',
            description: 'Best support team I\'ve ever worked with. They truly care about your success and go above and beyond.',
            icon: 'Marketing Director, BrandCo',
            image: '',
          },
        ],
        order: 3,
        visible: true,
      },
      // CTA
      {
        type: 'cta',
        title: 'Ready to Get Started?',
        subtitle: 'Join thousands of satisfied users and take your business to the next level.',
        buttonText: 'Start Your Free Trial',
        buttonLink: '/signup',
        secondaryButtonText: 'View Pricing',
        secondaryButtonLink: '/pricing',
        order: 4,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── FEATURES PAGE
  {
    title: 'Features',
    slug: 'features',
    description: 'Explore all platform features',
    metaTitle: 'Features — Powerful Tools for Your Business',
    metaDescription: 'Discover all the powerful features that make our platform the go-to choice for thousands of businesses.',
    status: 'published',
    isHomePage: false,
    showInNavigation: true,
    navigationOrder: 1,
    navigationLabel: 'Features',
    blocks: [
      // Hero
      {
        type: 'hero',
        title: 'Powerful Features Built for Growth',
        subtitle: 'Everything you need to optimize, automate, and scale your business — all in one platform.',
        buttonText: 'Get Started Free',
        buttonLink: '/signup',
        order: 0,
        visible: true,
      },
      // Core Features
      {
        type: 'features',
        title: 'Core Platform Features',
        subtitle: 'Our flagship features that set us apart from the competition.',
        items: [
          {
            title: 'AI-Powered Insights',
            description: 'Our AI engine analyzes your data in real-time, providing actionable recommendations to improve performance and drive growth.',
            icon: 'sparkles',
          },
          {
            title: 'Workflow Automation',
            description: 'Create custom automation rules to eliminate manual tasks. Set triggers, conditions, and actions with our visual builder.',
            icon: 'zap',
          },
          {
            title: 'Advanced Analytics',
            description: 'Deep-dive into your metrics with customizable reports, trend analysis, and predictive analytics powered by machine learning.',
            icon: 'bar-chart',
          },
          {
            title: 'Real-time Monitoring',
            description: 'Track your KPIs in real-time with live dashboards. Set alerts and notifications for critical metrics.',
            icon: 'target',
          },
          {
            title: 'Multi-channel Integration',
            description: 'Connect with your favorite tools and platforms. We support 100+ integrations out of the box.',
            icon: 'upload',
          },
          {
            title: 'Role-Based Access',
            description: 'Manage your team with granular permissions. Create custom roles and control who sees what.',
            icon: 'shield',
          },
        ],
        order: 1,
        visible: true,
      },
      // Additional Features
      {
        type: 'features',
        title: 'And So Much More',
        subtitle: 'Additional tools to supercharge your workflow.',
        items: [
          {
            title: 'Custom Reports',
            description: 'Build beautiful, shareable reports with drag-and-drop. Export as PDF, CSV, or share a live link.',
            icon: 'bar-chart',
          },
          {
            title: 'API Access',
            description: 'Full REST API access for developers. Build custom integrations and extend the platform to meet your unique needs.',
            icon: 'zap',
          },
          {
            title: 'Priority Support',
            description: 'Get help when you need it with our dedicated support team. Priority response times for premium plans.',
            icon: 'message',
          },
        ],
        order: 2,
        visible: true,
      },
      // CTA
      {
        type: 'cta',
        title: 'See It in Action',
        subtitle: 'Ready to experience all these features? Start your free trial today — no credit card required.',
        buttonText: 'Start Free Trial',
        buttonLink: '/signup',
        secondaryButtonText: 'View Pricing',
        secondaryButtonLink: '/pricing',
        order: 3,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── PRICING PAGE
  {
    title: 'Pricing',
    slug: 'pricing',
    description: 'Pricing plans for every business size',
    metaTitle: 'Pricing — Simple, Transparent Pricing',
    metaDescription: 'Choose the perfect plan for your business. Start free and upgrade as you grow.',
    status: 'published',
    isHomePage: false,
    showInNavigation: true,
    navigationOrder: 2,
    navigationLabel: 'Pricing',
    blocks: [
      // Hero
      {
        type: 'hero',
        title: 'Simple, Transparent Pricing',
        subtitle: 'No hidden fees. No surprises. Choose the plan that fits your business and upgrade anytime.',
        order: 0,
        visible: true,
      },
      // Pricing Cards
      {
        type: 'pricing',
        title: 'Choose Your Plan',
        subtitle: 'All plans include a 14-day free trial. No credit card required.',
        items: [
          {
            title: 'Free',
            price: '$0',
            description: 'Perfect for getting started',
            features: [
              'Up to 100 tasks/month',
              'Basic analytics',
              'Email support',
              'Single user',
              'Community access',
            ],
            highlighted: false,
          },
          {
            title: 'Starter',
            price: '$29/mo',
            description: 'For growing businesses',
            features: [
              'Up to 1,000 tasks/month',
              'Advanced analytics',
              'Priority email support',
              'Up to 5 team members',
              'API access',
              'Custom reports',
            ],
            highlighted: false,
          },
          {
            title: 'Professional',
            price: '$79/mo',
            description: 'For scaling teams',
            features: [
              'Unlimited tasks',
              'AI-powered insights',
              'Priority chat & email support',
              'Up to 25 team members',
              'Full API access',
              'Custom integrations',
              'Advanced automation',
            ],
            highlighted: true,
          },
          {
            title: 'Enterprise',
            price: 'Custom',
            description: 'For large organizations',
            features: [
              'Everything in Professional',
              'Unlimited team members',
              'Dedicated account manager',
              '24/7 phone support',
              'Custom SLA',
              'On-premise deployment',
              'SSO & advanced security',
            ],
            highlighted: false,
          },
        ],
        order: 1,
        visible: true,
      },
      // FAQ
      {
        type: 'faq',
        title: 'Frequently Asked Questions',
        subtitle: 'Got questions? We\'ve got answers.',
        items: [
          {
            title: 'Can I switch plans anytime?',
            description: 'Yes! You can upgrade or downgrade your plan at any time. Changes take effect at the start of your next billing cycle.',
          },
          {
            title: 'Is there a free trial?',
            description: 'Absolutely! All paid plans come with a 14-day free trial. No credit card required to start.',
          },
          {
            title: 'What payment methods do you accept?',
            description: 'We accept all major credit cards (Visa, Mastercard, American Express), PayPal, and bank transfers for enterprise plans.',
          },
          {
            title: 'Can I cancel anytime?',
            description: 'Yes, you can cancel your subscription at any time. There are no long-term contracts or cancellation fees.',
          },
          {
            title: 'Do you offer discounts for annual billing?',
            description: 'Yes! Save 20% when you choose annual billing. Contact our sales team for custom enterprise pricing.',
          },
        ],
        order: 2,
        visible: true,
      },
      // CTA
      {
        type: 'cta',
        title: 'Start Your Free Trial Today',
        subtitle: 'No credit card required. Get full access for 14 days.',
        buttonText: 'Get Started Free',
        buttonLink: '/signup',
        order: 3,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── CONTACT PAGE
  {
    title: 'Contact Us',
    slug: 'contact',
    description: 'Get in touch with our team',
    metaTitle: 'Contact Us — We\'d Love to Hear From You',
    metaDescription: 'Have questions or feedback? Reach out to our team. We typically respond within 24 hours.',
    status: 'published',
    isHomePage: false,
    showInNavigation: true,
    navigationOrder: 3,
    navigationLabel: 'Contact',
    blocks: [
      // Hero
      {
        type: 'hero',
        title: 'Get in Touch',
        subtitle: 'Have a question, feedback, or just want to say hello? We\'d love to hear from you.',
        order: 0,
        visible: true,
      },
      // Contact Form
      {
        type: 'contact',
        title: 'Send Us a Message',
        subtitle: 'Fill out the form below and we\'ll get back to you within 24 hours.',
        content: 'Our team is available Monday through Friday, 9am to 6pm (EST). For urgent matters, please email our support team directly.',
        items: [
          {
            title: 'Office Address',
            description: '123 Business Ave, Suite 100, New York, NY 10001',
            icon: 'map',
          },
          {
            title: 'Phone',
            description: '+1 (555) 123-4567',
            icon: 'phone',
          },
        ],
        order: 1,
        visible: true,
      },
      // FAQ
      {
        type: 'faq',
        title: 'Common Questions',
        items: [
          {
            title: 'What is your typical response time?',
            description: 'We aim to respond to all inquiries within 24 hours during business days.',
          },
          {
            title: 'Do you offer live demos?',
            description: 'Yes! You can schedule a live demo with our team. Just mention it in your message and we\'ll set it up.',
          },
          {
            title: 'Where are you located?',
            description: 'Our headquarters are in New York, but our team is distributed globally to serve customers in every timezone.',
          },
        ],
        order: 2,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── PRIVACY POLICY
  {
    title: 'Privacy Policy',
    slug: 'privacy',
    description: 'Our privacy policy',
    metaTitle: 'Privacy Policy',
    metaDescription: 'Learn how we collect, use, and protect your personal information.',
    status: 'published',
    isHomePage: false,
    showInNavigation: false,
    navigationOrder: 90,
    blocks: [
      {
        type: 'text',
        title: 'Privacy Policy',
        subtitle: 'Last updated: February 2026',
        content: `Your privacy is important to us. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.

1. Information We Collect

We collect information you provide directly to us, such as when you create an account, make a purchase, or contact us for support. This includes:
• Name and email address
• Billing and payment information
• Usage data and analytics
• Device and browser information
• Cookies and similar tracking technologies

2. How We Use Your Information

We use the information we collect to:
• Provide, maintain, and improve our services
• Process transactions and send related notifications
• Send you technical notices, updates, and support messages
• Respond to your comments, questions, and customer service requests
• Monitor and analyze trends, usage, and activities
• Detect, investigate, and prevent fraudulent or unauthorized activities

3. Information Sharing

We do not sell, trade, or otherwise transfer your personal information to outside parties except as described in this policy. We may share your information with:
• Service providers who assist in our operations
• Legal authorities when required by law
• Business partners with your consent

4. Data Security

We implement appropriate technical and organizational security measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.

5. Your Rights

You have the right to:
• Access and update your personal information
• Request deletion of your data
• Opt-out of marketing communications
• Request a copy of your data in a portable format

6. Cookies

We use cookies and similar technologies to enhance your experience, analyze usage, and assist in our marketing efforts. You can control cookies through your browser settings.

7. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date.

8. Contact Us

If you have any questions about this Privacy Policy, please contact us through our contact page or email our support team.`,
        order: 0,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── TERMS & CONDITIONS
  {
    title: 'Terms & Conditions',
    slug: 'terms',
    description: 'Terms of service',
    metaTitle: 'Terms & Conditions',
    metaDescription: 'Read our terms of service and conditions for using our platform.',
    status: 'published',
    isHomePage: false,
    showInNavigation: false,
    navigationOrder: 91,
    blocks: [
      {
        type: 'text',
        title: 'Terms & Conditions',
        subtitle: 'Last updated: February 2026',
        content: `Welcome to our platform. By accessing or using our services, you agree to be bound by these Terms and Conditions.

1. Acceptance of Terms

By creating an account or using our service, you agree to these terms. If you do not agree, please do not use our services.

2. Account Registration

You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account.

3. Acceptable Use

You agree not to:
• Use the service for any unlawful purpose
• Upload or transmit viruses or malicious code
• Attempt to gain unauthorized access to our systems
• Interfere with or disrupt the service
• Reproduce, duplicate, or resell any part of the service
• Use the service to send spam or unsolicited messages

4. Intellectual Property

All content, features, and functionality of the platform are owned by us and are protected by international copyright, trademark, and other intellectual property laws.

5. Payment Terms

• Paid subscriptions are billed in advance on a monthly or annual basis
• All fees are non-refundable except as expressly stated in these terms
• We reserve the right to change our pricing with 30 days notice
• Failed payments may result in service suspension

6. Termination

We may terminate or suspend your account at any time for violation of these terms. You may cancel your account at any time through your account settings.

7. Limitation of Liability

Our service is provided "as is" without warranties of any kind. We shall not be liable for any indirect, incidental, special, or consequential damages arising out of your use of the service.

8. Disclaimer of Warranties

We do not warrant that the service will be uninterrupted, error-free, or secure. You use the service at your own risk.

9. Governing Law

These terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.

10. Changes to Terms

We reserve the right to modify these terms at any time. Continued use of the service after changes constitutes acceptance of the new terms.

11. Contact

For questions about these Terms & Conditions, please reach out through our contact page.`,
        order: 0,
        visible: true,
      },
    ],
  },

  // ────────────────────────────────────────── BLOG
  {
    title: 'Blog',
    slug: 'blog',
    description: 'Latest news, tips, and insights',
    metaTitle: 'Blog — Tips, News & Insights',
    metaDescription: 'Stay up to date with the latest tips, product updates, and industry insights from our team.',
    status: 'published',
    isHomePage: false,
    showInNavigation: true,
    navigationOrder: 4,
    navigationLabel: 'Blog',
    blocks: [
      // Hero
      {
        type: 'hero',
        title: 'Our Blog',
        subtitle: 'Tips, tutorials, product updates, and industry insights to help you grow your business.',
        order: 0,
        visible: true,
      },
      // Featured posts as features cards
      {
        type: 'features',
        title: 'Latest Articles',
        subtitle: 'Stay up to date with our latest posts.',
        items: [
          {
            title: 'Getting Started: A Complete Guide',
            description: 'Everything you need to know to set up your account, configure your first project, and start seeing results in minutes.',
            icon: 'sparkles',
            image: '',
          },
          {
            title: '10 Tips to Maximize Your Productivity',
            description: 'Learn the top strategies our power users employ to get the most out of the platform and save hours every week.',
            icon: 'target',
            image: '',
          },
          {
            title: 'Understanding AI-Powered Analytics',
            description: 'A deep dive into how our AI engine works, what data it analyzes, and how to interpret the insights it provides.',
            icon: 'bar-chart',
            image: '',
          },
          {
            title: 'Security Best Practices for Teams',
            description: 'How to set up role-based access, enable two-factor authentication, and keep your team\'s data secure.',
            icon: 'shield',
            image: '',
          },
          {
            title: 'Product Update: What\'s New This Month',
            description: 'A roundup of the latest features, improvements, and bug fixes we shipped this month.',
            icon: 'zap',
            image: '',
          },
          {
            title: 'Case Study: How GrowthLab Scaled 3x',
            description: 'Learn how GrowthLab used our platform to triple their output while cutting costs by 40%.',
            icon: 'users',
            image: '',
          },
        ],
        order: 1,
        visible: true,
      },
      // Newsletter CTA
      {
        type: 'cta',
        title: 'Subscribe to Our Newsletter',
        subtitle: 'Get the latest articles, tips, and product updates delivered straight to your inbox. No spam, ever.',
        buttonText: 'Subscribe Now',
        buttonLink: '/contact',
        order: 2,
        visible: true,
      },
    ],
  },
];


const seedMarketingPages = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ Connected to MongoDB');

    // Check existing pages
    const existingCount = await MarketingPage.countDocuments();
    if (existingCount > 0) {
      console.log(`⚠️  Found ${existingCount} existing marketing page(s).`);
      console.log('   Deleting existing pages before re-seeding...');
      await MarketingPage.deleteMany({});
      console.log('   Deleted all existing marketing pages.');
    }

    // Insert all pages
    const created = await MarketingPage.insertMany(defaultPages);
    console.log(`\n🎉 Successfully created ${created.length} marketing pages:\n`);
    created.forEach((page) => {
      console.log(`   ${page.isHomePage ? '🏠' : '📄'} ${page.title.padEnd(22)} → /${page.slug} (${page.blocks.length} blocks) [${page.status}]`);
    });

    console.log('\n✅ Seed complete! You can now edit these pages from the Admin Center → Marketing Site → Pages.');
    process.exit(0);
  } catch (err) {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  }
};

seedMarketingPages();
