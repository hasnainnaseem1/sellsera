import React from 'react';
import { Zap, Shield, Lock, Eye, Database, Mail } from 'lucide-react';

const PrivacyPolicyPage = () => {
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
          <Shield className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Privacy Policy
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
              Sellsera ("we", "our", or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our service.
            </p>
            <p className="text-lg text-gray-700 leading-relaxed">
              By using Sellsera, you agree to the collection and use of information in accordance with this policy.
            </p>
          </div>

          {/* Quick Summary */}
          <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8 mb-12">
            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
              <Eye className="w-6 h-6 text-purple-600" />
              Quick Summary
            </h2>
            <ul className="space-y-3 text-gray-700">
              <li className="flex items-start gap-2">
                <span className="text-purple-600 text-xl">•</span>
                <span>We only collect data necessary to provide our service</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 text-xl">•</span>
                <span>We never sell your personal information to third parties</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 text-xl">•</span>
                <span>Your listing data is used solely for analysis and improvement recommendations</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 text-xl">•</span>
                <span>You can request deletion of your data at any time</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-purple-600 text-xl">•</span>
                <span>We use industry-standard encryption to protect your data</span>
              </li>
            </ul>
          </div>

          {/* Section 1 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Database className="w-8 h-8 text-purple-600" />
              1. Information We Collect
            </h2>

            <div className="space-y-6 text-gray-700">
              <div>
                <h3 className="text-xl font-bold mb-3">1.1 Information You Provide</h3>
                <p className="mb-3">When you create an account or use our service, we collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Account Information:</strong> Email address, password (encrypted), and display name</li>
                  <li><strong>Listing Data:</strong> Product titles, descriptions, tags, prices, categories, and images that you submit for analysis</li>
                  <li><strong>Payment Information:</strong> Processed securely through LemonSqueezy (we never store your credit card details)</li>
                  <li><strong>Communication Data:</strong> Messages you send us through contact forms or email</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-3">1.2 Automatically Collected Information</h3>
                <p className="mb-3">When you use our service, we automatically collect:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li><strong>Usage Data:</strong> Features used, analyses performed, timestamps</li>
                  <li><strong>Device Information:</strong> Browser type, operating system, device type</li>
                  <li><strong>Log Data:</strong> IP address, access times, pages viewed</li>
                  <li><strong>Cookies:</strong> Session tokens, preferences, analytics data</li>
                </ul>
              </div>

              <div>
                <h3 className="text-xl font-bold mb-3">1.3 Third-Party API Data</h3>
                <p className="mb-3">If you connect your marketplace account:</p>
                <ul className="list-disc pl-6 space-y-2">
                  <li>We access your public shop information via the marketplace API</li>
                  <li>We retrieve listing data you authorize us to analyze</li>
                  <li>We do NOT access your sales data, customer information, or financial details</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Section 2 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Zap className="w-8 h-8 text-purple-600" />
              2. How We Use Your Information
            </h2>

            <div className="space-y-4 text-gray-700">
              <p>We use the collected information for the following purposes:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Service Delivery:</strong> To analyze your listings and provide optimization recommendations</li>
                <li><strong>AI Analysis:</strong> To process your listing data through our AI engine (Anthropic Claude API)</li>
                <li><strong>Competitor Research:</strong> To find and analyze similar listings in your niche</li>
                <li><strong>Account Management:</strong> To create and maintain your user account</li>
                <li><strong>Billing:</strong> To process payments and manage subscriptions via LemonSqueezy</li>
                <li><strong>Communication:</strong> To send you service updates, weekly reports, and support responses</li>
                <li><strong>Improvement:</strong> To improve our service, develop new features, and fix bugs</li>
                <li><strong>Security:</strong> To detect and prevent fraud, abuse, and unauthorized access</li>
                <li><strong>Legal Compliance:</strong> To comply with legal obligations and enforce our Terms of Service</li>
              </ul>
            </div>
          </section>

          {/* Section 3 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Lock className="w-8 h-8 text-purple-600" />
              3. How We Share Your Information
            </h2>

            <div className="space-y-4 text-gray-700">
              <p className="font-semibold">We do NOT sell your personal information. We may share your information only in these limited circumstances:</p>
              
              <div className="space-y-4">
                <div>
                  <h3 className="font-bold mb-2">3.1 Service Providers</h3>
                  <p>We share data with trusted third-party services that help us operate:</p>
                  <ul className="list-disc pl-6 space-y-1 mt-2">
                    <li><strong>Anthropic (Claude AI):</strong> For AI-powered listing analysis</li>
                    <li><strong>Marketplace API:</strong> For retrieving your authorized listing data</li>
                    <li><strong>LemonSqueezy:</strong> For payment processing</li>
                    <li><strong>SendGrid:</strong> For sending emails</li>
                    <li><strong>Cloud Hosting:</strong> For data storage and application hosting</li>
                  </ul>
                  <p className="mt-2 text-sm">All service providers are contractually obligated to protect your data and use it only for specified purposes.</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">3.2 Legal Requirements</h3>
                  <p>We may disclose your information if required by law, legal process, or government request.</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">3.3 Business Transfers</h3>
                  <p>If we are acquired or merged with another company, your information may be transferred to the new owners.</p>
                </div>

                <div>
                  <h3 className="font-bold mb-2">3.4 With Your Consent</h3>
                  <p>We may share your information for other purposes with your explicit consent.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">4. Data Security</h2>

            <div className="space-y-4 text-gray-700">
              <p>We implement industry-standard security measures to protect your information:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Encryption:</strong> All data transmitted to/from our servers uses TLS/SSL encryption</li>
                <li><strong>Password Security:</strong> Passwords are hashed using bcrypt before storage</li>
                <li><strong>Access Controls:</strong> Limited employee access to user data on a need-to-know basis</li>
                <li><strong>Regular Audits:</strong> We regularly review our security practices</li>
                <li><strong>Secure Infrastructure:</strong> Hosted on secure cloud servers with enterprise-grade protection</li>
              </ul>
              <p className="mt-4 text-sm bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <strong>Note:</strong> While we strive to protect your data, no method of transmission over the internet is 100% secure. Use Sellsera at your own risk.
              </p>
            </div>
          </section>

          {/* Section 5 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">5. Your Rights and Choices</h2>

            <div className="space-y-4 text-gray-700">
              <p>You have the following rights regarding your data:</p>
              
              <div className="space-y-3">
                <div>
                  <h3 className="font-bold">✓ Access</h3>
                  <p>Request a copy of all personal data we hold about you</p>
                </div>
                <div>
                  <h3 className="font-bold">✓ Correction</h3>
                  <p>Update or correct inaccurate information in your account settings</p>
                </div>
                <div>
                  <h3 className="font-bold">✓ Deletion</h3>
                  <p>Request deletion of your account and associated data (subject to legal retention requirements)</p>
                </div>
                <div>
                  <h3 className="font-bold">✓ Export</h3>
                  <p>Download your analysis history in CSV or JSON format</p>
                </div>
                <div>
                  <h3 className="font-bold">✓ Opt-Out</h3>
                  <p>Unsubscribe from marketing emails (service emails may still be sent)</p>
                </div>
                <div>
                  <h3 className="font-bold">✓ Revoke Consent</h3>
                  <p>Disconnect your marketplace account authorization at any time</p>
                </div>
              </div>

              <p className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
                <strong>To exercise these rights:</strong> Email us at{' '}
                <a href="mailto:hasnainn37@gmail.com" className="text-purple-600 font-semibold hover:underline">
                  hasnainn37@gmail.com
                </a>{' '}
                with your request. We'll respond within 30 days.
              </p>
            </div>
          </section>

          {/* Section 6 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">6. Data Retention</h2>

            <div className="space-y-4 text-gray-700">
              <p>We retain your information for as long as necessary to provide our service:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Account Data:</strong> Retained until you delete your account</li>
                <li><strong>Analysis History:</strong> Retained for the duration of your subscription</li>
                <li><strong>Billing Records:</strong> Retained for 7 years for tax and legal compliance</li>
                <li><strong>Log Data:</strong> Retained for 90 days for security and debugging purposes</li>
              </ul>
              <p className="mt-4">After account deletion, we anonymize or delete your data within 30 days, except where required by law.</p>
            </div>
          </section>

          {/* Section 7 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">7. Cookies and Tracking</h2>

            <div className="space-y-4 text-gray-700">
              <p>We use cookies and similar technologies to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>Keep you logged in to your account</li>
                <li>Remember your preferences and settings</li>
                <li>Analyze usage patterns and improve our service</li>
                <li>Prevent fraud and abuse</li>
              </ul>
              <p className="mt-4">You can control cookies through your browser settings. Disabling cookies may affect service functionality.</p>
            </div>
          </section>

          {/* Section 8 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">8. Third-Party Links</h2>

            <div className="space-y-4 text-gray-700">
              <p>Our service may contain links to third-party websites (e.g., marketplace platforms, competitor listings). We are not responsible for the privacy practices of these external sites. We encourage you to read their privacy policies.</p>
            </div>
          </section>

          {/* Section 9 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">9. Children's Privacy</h2>

            <div className="space-y-4 text-gray-700">
              <p>Sellsera is not intended for users under 18 years of age. We do not knowingly collect personal information from children. If you believe a child has provided us with personal information, please contact us immediately.</p>
            </div>
          </section>

          {/* Section 10 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">10. International Data Transfers</h2>

            <div className="space-y-4 text-gray-700">
              <p>Your information may be transferred to and processed in countries other than your country of residence, including the United States. These countries may have different data protection laws. By using our service, you consent to such transfers.</p>
              <p>We ensure appropriate safeguards are in place to protect your data during international transfers, in accordance with applicable data protection laws.</p>
            </div>
          </section>

          {/* Section 11 */}
          <section className="mb-12">
            <h2 className="text-3xl font-bold mb-6">11. Changes to This Policy</h2>

            <div className="space-y-4 text-gray-700">
              <p>We may update this Privacy Policy from time to time. Changes will be posted on this page with an updated "Last Updated" date. Significant changes will be communicated via email.</p>
              <p>Continued use of Sellsera after changes constitutes acceptance of the updated policy.</p>
            </div>
          </section>

          {/* Contact Section */}
          <section className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border-2 border-purple-200">
            <h2 className="text-3xl font-bold mb-6 flex items-center gap-2">
              <Mail className="w-8 h-8 text-purple-600" />
              12. Contact Us
            </h2>

            <div className="space-y-4 text-gray-700">
              <p>If you have questions about this Privacy Policy or how we handle your data, please contact us:</p>
              
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
                We will respond to privacy-related inquiries within 30 days.
              </p>
            </div>
          </section>

          {/* Acknowledgment */}
          <div className="mt-12 p-6 bg-gray-50 rounded-xl border border-gray-200">
            <p className="text-sm text-gray-600 text-center">
              By using Sellsera, you acknowledge that you have read and understood this Privacy Policy and agree to its terms.
            </p>
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

export default PrivacyPolicyPage;