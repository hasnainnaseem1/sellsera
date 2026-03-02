import React from 'react';
import { Zap, FileText, AlertCircle, DollarSign, Shield, XCircle } from 'lucide-react';

const TermsOfServicePage = () => {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <Zap className="w-6 h-6 text-purple-600" />
              <span className="text-xl font-bold text-purple-600">Sellsera</span>
            </div>
            <div className="hidden md:flex items-center gap-8">
              <a href="/" className="text-gray-700 hover:text-purple-600">Home</a>
              <a href="/features" className="text-gray-700 hover:text-purple-600">Features</a>
              <a href="/pricing" className="text-gray-700 hover:text-purple-600">Pricing</a>
              <a href="/contact" className="text-gray-700 hover:text-purple-600">Contact</a>
              <a href="/login" className="text-gray-700 hover:text-purple-600">Login</a>
              <button className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700">
                Get Started Free
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-500 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FileText className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-white/90">
            Last Updated: January 19, 2025
          </p>
        </div>
      </div>

      {/* Content */}
      <div className="py-16">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Introduction */}
          <div className="mb-12">
            <p className="text-lg text-gray-700 leading-relaxed mb-4">
              Welcome to Sellsera. These Terms of Service ("Terms") govern your access to and use of our service. Please read them carefully.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed font-semibold">
              By accessing or using Sellsera, you agree to be bound by these Terms. If you do not agree, do not use our service.
            </p>
          </div>

          {/* Important Notice */}
          <div className="bg-yellow-50 border-2 border-yellow-300 rounded-xl p-6 mb-12">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-bold text-lg mb-2 text-gray-800">Important Notice</h3>
                <ul className="space-y-2 text-gray-700 text-sm">
                  <li>• Sellsera is a tool to help optimize listings—results are not guaranteed</li>
                  <li>• You are responsible for complying with marketplace policies when implementing our recommendations</li>
                  <li>• We are not affiliated with or endorsed by any marketplace platform</li>
                  <li>• Misuse of our service may result in immediate account termination</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">1. Acceptance of Terms</h2>
            <div className="space-y-4 text-gray-700">
              <p>By creating an account, accessing, or using Sellsera, you confirm that:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>You are at least 18 years old or have parental/guardian consent</li>
                <li>You have the legal capacity to enter into a binding contract</li>
                <li>You will comply with all applicable laws and regulations</li>
                <li>All information you provide is accurate and up-to-date</li>
                <li>You have read and agree to our Privacy Policy</li>
              </ul>
              <p className="mt-4">We reserve the right to refuse service to anyone at any time for any reason.</p>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">2. Description of Service</h2>
            <div className="space-y-4 text-gray-700">
              <p>Sellsera provides:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI-powered analysis of product listings</li>
                <li>Optimization recommendations for titles, descriptions, tags, and pricing</li>
                <li>Competitor intelligence and market research</li>
                <li>Weekly performance monitoring and alerts</li>
                <li>Bulk analysis and export features (on paid plans)</li>
              </ul>
              <p className="mt-4 font-semibold">Important Disclaimers:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Our recommendations are suggestions based on AI analysis—not guarantees of increased sales</li>
                <li>Results vary based on many factors outside our control (product quality, market demand, competition, etc.)</li>
                <li>We do not directly modify your listings—you choose which recommendations to implement</li>
                <li>We are not responsible for any consequences of implementing our recommendations</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">3. User Account</h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">3.1 Account Creation</h3>
              <p>To use Sellsera, you must:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your password</li>
                <li>Accept responsibility for all activities under your account</li>
                <li>Notify us immediately of any unauthorized use</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">3.2 Account Security</h3>
              <p>You are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Keeping your login credentials confidential</li>
                <li>All activity that occurs under your account</li>
                <li>Notifying us immediately of any security breach</li>
              </ul>
              <p className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
                <strong>Warning:</strong> Sharing your account with others or creating multiple accounts to bypass usage limits is strictly prohibited and may result in immediate termination.
              </p>

              <h3 className="text-xl font-bold mb-2 mt-6">3.3 Account Termination</h3>
              <p>We may suspend or terminate your account if you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate these Terms of Service</li>
                <li>Engage in fraudulent or illegal activity</li>
                <li>Abuse or misuse our service</li>
                <li>Fail to pay subscription fees</li>
                <li>Are inactive for more than 12 months</li>
              </ul>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <DollarSign className="w-8 h-8 text-purple-600" />
              4. Subscription and Billing
            </h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">4.1 Subscription Plans</h3>
              <p>We offer the following plans:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Free Plan:</strong> 1 listing analysis, all optimization features</li>
                <li><strong>Starter ($19/month):</strong> 50 analyses/month, history, email support</li>
                <li><strong>Pro ($49/month):</strong> 250 analyses/month, weekly monitoring, priority support, bulk upload</li>
                <li><strong>Unlimited ($79/month):</strong> Unlimited analyses, daily monitoring, API access, white-label option</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">4.2 Payment Terms</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>All payments are processed securely through LemonSqueezy</li>
                <li>Subscriptions are billed monthly in advance</li>
                <li>You authorize us to charge your payment method automatically</li>
                <li>Prices are in USD unless otherwise stated</li>
                <li>We reserve the right to change prices with 30 days notice</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">4.3 Free Trial</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>New users receive 1 free listing analysis</li>
                <li>Paid plans may include a 7-day free trial</li>
                <li>No credit card required for free tier</li>
                <li>Cancel anytime during trial period without charge</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">4.4 Cancellation and Refunds</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>You can cancel your subscription anytime from your account settings</li>
                <li>Cancellations take effect at the end of the current billing period</li>
                <li>No refunds for partial months of service</li>
                <li>7-day money-back guarantee for first-time subscribers</li>
                <li>Refund requests must be submitted to hasnainn37@gmail.com</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">4.5 Failed Payments</h3>
              <p>If your payment fails:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>We will attempt to charge your card up to 3 times</li>
                <li>Your account will be downgraded to the Free plan</li>
                <li>You will lose access to paid features</li>
                <li>Your data will be retained for 30 days</li>
              </ul>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">5. Acceptable Use Policy</h2>
            <div className="space-y-4 text-gray-700">
              <p>You agree NOT to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Abuse the Service:</strong> Use automated tools, bots, or scrapers to access our API</li>
                <li><strong>Violate Laws:</strong> Use our service for any illegal purpose or to violate any laws</li>
                <li><strong>Infringe Rights:</strong> Upload content that infringes intellectual property or privacy rights</li>
                <li><strong>Harm Others:</strong> Use our service to harass, abuse, or harm other users</li>
                <li><strong>Manipulate Markets:</strong> Coordinate with others to artificially manipulate marketplace rankings</li>
                <li><strong>Reverse Engineer:</strong> Attempt to reverse engineer, decompile, or hack our service</li>
                <li><strong>Resell Service:</strong> Resell or redistribute our service without written permission</li>
                <li><strong>Spam:</strong> Send unsolicited communications through our service</li>
                <li><strong>Overload Systems:</strong> Intentionally burden our servers or infrastructure</li>
              </ul>
              <p className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 font-semibold">
                Violation of this policy may result in immediate account termination without refund.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">6. Intellectual Property</h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">6.1 Our Property</h3>
              <p>Sellsera and all related content, features, and functionality are owned by us and protected by copyright, trademark, and other intellectual property laws.</p>
              <p className="mt-2">You may not:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Copy, modify, or create derivative works of our service</li>
                <li>Use our branding, logos, or trademarks without permission</li>
                <li>Remove or alter any proprietary notices</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">6.2 Your Content</h3>
              <p>You retain all rights to the listing content you submit. By using our service, you grant us a limited license to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Process and analyze your listing data</li>
                <li>Store your data on our servers</li>
                <li>Use anonymized, aggregated data to improve our service</li>
              </ul>
              <p className="mt-4">You represent and warrant that you own or have permission to use all content you submit.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">7. Third-Party Services</h2>
            <div className="space-y-4 text-gray-700">
              <p>Our service integrates with third-party services, including:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Marketplace API:</strong> For retrieving listing data (subject to marketplace Terms of Use)</li>
                <li><strong>Anthropic Claude:</strong> For AI-powered analysis</li>
                <li><strong>LemonSqueezy:</strong> For payment processing</li>
              </ul>
              <p className="mt-4">We are not responsible for:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>The availability, accuracy, or reliability of third-party services</li>
                <li>Changes to third-party terms, policies, or pricing</li>
                <li>Actions taken by the marketplace based on your use of our recommendations</li>
              </ul>
              <p className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <strong>Important:</strong> You must comply with your marketplace's Terms of Use, Seller Policy, and all other applicable policies when using Sellsera.
              </p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <XCircle className="w-8 h-8 text-red-600" />
              8. Disclaimers and Limitations
            </h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">8.1 No Guarantees</h3>
              <p className="font-semibold">SELLSERA IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND.</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>We do not guarantee increased sales, traffic, or rankings</li>
                <li>We do not guarantee accuracy of our recommendations</li>
                <li>We do not guarantee uninterrupted or error-free service</li>
                <li>Results vary based on factors outside our control</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">8.2 Limitation of Liability</h3>
              <p className="font-semibold">TO THE MAXIMUM EXTENT PERMITTED BY LAW:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>We are not liable for any indirect, incidental, special, or consequential damages</li>
                <li>Our total liability will not exceed the amount you paid in the past 12 months</li>
                <li>We are not liable for lost profits, data loss, or business interruption</li>
                <li>We are not responsible for actions taken by the marketplace or other third parties</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">8.3 AI Limitations</h3>
              <p>Our AI analysis is based on algorithms and machine learning, which have inherent limitations:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>AI can make mistakes or provide suboptimal recommendations</li>
                <li>Market conditions change rapidly and unpredictably</li>
                <li>Competitor behavior cannot be predicted with certainty</li>
                <li>You should use your own judgment when implementing suggestions</li>
              </ul>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">9. Indemnification</h2>
            <div className="space-y-4 text-gray-700">
              <p>You agree to indemnify, defend, and hold harmless Sellsera, its owners, employees, and affiliates from any claims, damages, losses, or expenses (including legal fees) arising from:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your use of our service</li>
                <li>Your violation of these Terms</li>
                <li>Your violation of any laws or third-party rights</li>
                <li>Content you submit to our service</li>
                <li>Actions taken by the marketplace based on your use of our recommendations</li>
              </ul>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">10. Changes to Terms</h2>
            <div className="space-y-4 text-gray-700">
              <p>We may modify these Terms at any time. Changes will be effective immediately upon posting to this page.</p>
              <p>Your continued use of Sellsera after changes constitutes acceptance of the updated Terms.</p>
              <p className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                We will notify you of significant changes via email or prominent notice on our website.
              </p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">11. Termination</h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">11.1 By You</h3>
              <p>You may terminate your account at any time by:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Canceling your subscription in account settings</li>
                <li>Emailing us at hasnainn37@gmail.com</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">11.2 By Us</h3>
              <p>We may terminate or suspend your account immediately if you:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Violate these Terms</li>
                <li>Engage in fraudulent activity</li>
                <li>Fail to pay fees</li>
                <li>Abuse our service or staff</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">11.3 Effect of Termination</h3>
              <p>Upon termination:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Your access to the service will cease immediately</li>
                <li>We may delete your data after 30 days</li>
                <li>You remain liable for any outstanding fees</li>
                <li>Sections of these Terms that should survive will remain in effect</li>
              </ul>
            </div>
          </section>

          {/* Section 12 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">12. Governing Law and Disputes</h2>
            <div className="space-y-4 text-gray-700">
              <h3 className="text-xl font-bold mb-2">12.1 Governing Law</h3>
              <p>These Terms are governed by the laws of Pakistan, without regard to conflict of law principles.</p>

              <h3 className="text-xl font-bold mb-2 mt-6">12.2 Dispute Resolution</h3>
              <p>Any disputes will be resolved through:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Good faith negotiation between parties</li>
                <li>Mediation if negotiation fails</li>
                <li>Arbitration or litigation as a last resort</li>
              </ul>

              <h3 className="text-xl font-bold mb-2 mt-6">12.3 Class Action Waiver</h3>
              <p>You agree to resolve disputes individually and waive any right to participate in class action lawsuits.</p>
            </div>
          </section>

          {/* Section 13 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">13. Miscellaneous</h2>
            <div className="space-y-4 text-gray-700">
              <ul className="list-disc pl-6 space-y-3">
                <li><strong>Entire Agreement:</strong> These Terms constitute the entire agreement between you and Sellsera</li>
                <li><strong>Severability:</strong> If any provision is found invalid, the remaining provisions remain in effect</li>
                <li><strong>Waiver:</strong> Failure to enforce any provision does not constitute a waiver</li>
                <li><strong>Assignment:</strong> You may not transfer your rights; we may assign these Terms</li>
                <li><strong>Force Majeure:</strong> We are not liable for delays caused by events beyond our control</li>
                <li><strong>No Partnership:</strong> These Terms do not create a partnership, agency, or employment relationship</li>
              </ul>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border-2 border-purple-200">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Shield className="w-8 h-8 text-purple-600" />
              14. Contact Information
            </h2>

            <div className="space-y-4 text-gray-700">
              <p>Questions about these Terms? Contact us:</p>
              
              <div className="bg-white rounded-xl p-6 space-y-3">
                <div>
                  <p className="font-bold text-gray-800">Sellsera</p>
                  <p className="text-sm text-gray-600">Listing Optimization Service</p>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Email:</p>
                  <a href="mailto:hasnainn37@gmail.com" className="text-purple-600 font-semibold hover:underline">
                    hasnainn37@gmail.com
                  </a>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700">Location:</p>
                  <p className="text-gray-600">Pakistan (Service hosted on US servers)</p>
                </div>
              </div>

              <p className="text-sm text-gray-600 mt-4">
                We will respond to legal inquiries within 30 days.
              </p>
            </div>
          </section>

          {/* Acknowledgment */}
          <div className="mt-12 p-6 bg-gray-900 text-white rounded-xl">
            <p className="text-center font-semibold mb-3">
              By clicking "I Agree" or using Sellsera, you acknowledge that:
            </p>
            <ul className="space-y-2 text-sm text-white/90">
              <li>✓ You have read and understood these Terms of Service</li>
              <li>✓ You agree to be legally bound by these Terms</li>
              <li>✓ You are 18+ years old or have parental consent</li>
              <li>✓ You will comply with all applicable laws and marketplace policies</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Zap className="w-6 h-6 text-purple-400" />
                <span className="text-xl font-bold">Sellsera</span>
              </div>
              <p className="text-gray-400">
                Listing optimization powered by AI. Get instant, copy-paste ready improvements to increase your sales.
              </p>
            </div>

            <div>
              <h4 className="font-bold mb-4">Product</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/features" className="hover:text-white">Features</a></li>
                <li><a href="/pricing" className="hover:text-white">Pricing</a></li>
                <li><a href="/contact" className="hover:text-white">Get Started</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-bold mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li><a href="/privacy" className="hover:text-white">Privacy Policy</a></li>
                <li><a href="/terms" className="hover:text-white">Terms of Service</a></li>
                <li><a href="/contact" className="hover:text-white">Contact Us</a></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2024 Sellsera. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default TermsOfServicePage;