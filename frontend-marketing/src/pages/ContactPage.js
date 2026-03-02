import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Mail, MessageSquare, Send, CheckCircle } from 'lucide-react';
import config from '../config';

function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    // In production, this would connect to your backend
    console.log('Form submitted:', formData);
    setSubmitted(true);
    setTimeout(() => {
      setSubmitted(false);
      setFormData({ name: '', email: '', subject: '', message: '' });
    }, 3000);
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-6">
            💬 We're Here to Help
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Get in Touch
          </h1>
          <p className="text-xl text-white/90 max-w-2xl mx-auto">
            Have questions about our platform? Need help getting started?
            We'd love to hear from you.
          </p>
        </div>
      </div>

      {/* Contact Section */}
      <div className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            {/* Contact Form */}
            <div>
              <h2 className="text-3xl font-bold mb-6">Send Us a Message</h2>
              <p className="text-gray-600 mb-8">
                Fill out the form below and we'll get back to you within 24 hours.
              </p>

              {submitted ? (
                <div className="bg-green-50 border-2 border-green-200 rounded-xl p-8 text-center">
                  <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                  <h3 className="text-2xl font-bold text-green-700 mb-2">Message Sent!</h3>
                  <p className="text-green-600">We'll get back to you within 24 hours.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Your Name
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder="John Doe"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Email Address
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder="you@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Subject
                    </label>
                    <input
                      type="text"
                      name="subject"
                      value={formData.subject}
                      onChange={handleChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none"
                      placeholder="How can we help?"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Message
                    </label>
                    <textarea
                      name="message"
                      value={formData.message}
                      onChange={handleChange}
                      rows="6"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-none"
                      placeholder="Tell us more about your question or concern..."
                    />
                  </div>

                  <button
                    onClick={handleSubmit}
                    className="w-full bg-purple-600 text-white py-4 rounded-lg font-semibold hover:bg-purple-700 flex items-center justify-center gap-2 transition-colors"
                  >
                    <Send size={20} />
                    Send Message
                  </button>
                </div>
              )}
            </div>

            {/* Contact Info & FAQ */}
            <div>
              <h2 className="text-3xl font-bold mb-6">Other Ways to Reach Us</h2>

              {/* Contact Cards */}
              <div className="space-y-4 mb-12">
                <div className="bg-purple-50 rounded-xl p-6 border border-purple-200">
                  <div className="flex items-start gap-4">
                    <Mail className="w-6 h-6 text-purple-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-1">Email Support</h3>
                      <p className="text-gray-600 mb-2">
                        Get help via email, usually within 24 hours
                      </p>
                      <a href="mailto:hasnainn37@gmail.com" className="text-purple-600 font-semibold hover:underline">
                        hasnainn37@gmail.com
                      </a>
                    </div>
                  </div>
                </div>

                <div className="bg-blue-50 rounded-xl p-6 border border-blue-200">
                  <div className="flex items-start gap-4">
                    <MessageSquare className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
                    <div>
                      <h3 className="font-bold text-lg mb-1">Live Chat</h3>
                      <p className="text-gray-600 mb-2">
                        Chat with us in real-time (Coming Soon)
                      </p>
                      <span className="text-gray-500 text-sm">Available Mon-Fri, 9am-5pm EST</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick FAQ */}
              <div className="bg-gray-50 rounded-xl p-8">
                <h3 className="text-2xl font-bold mb-6">Quick Questions?</h3>
                
                <div className="space-y-6">
                  <div>
                    <h4 className="font-bold text-lg mb-2">How does the free trial work?</h4>
                    <p className="text-gray-600 text-sm">
                      You get 1 free listing analysis with no credit card required. Just sign up and start analyzing!
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-lg mb-2">Can I cancel anytime?</h4>
                    <p className="text-gray-600 text-sm">
                      Yes! All paid plans can be cancelled anytime. No questions asked, no cancellation fees.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-lg mb-2">Do you offer refunds?</h4>
                    <p className="text-gray-600 text-sm">
                      We offer a 7-day money-back guarantee on all paid plans if you're not satisfied.
                    </p>
                  </div>

                  <div>
                    <h4 className="font-bold text-lg mb-2">How is this different from eRank?</h4>
                    <p className="text-gray-600 text-sm">
                      We don't show you charts—we give you exact, copy-paste ready improvements. No analysis needed!
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-8 border-t border-gray-200">
                  <p className="text-sm text-gray-600">
                    Still have questions? Check our{' '}
                    <Link to="/pricing" className="text-purple-600 font-semibold hover:underline">
                      full FAQ section
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20 bg-gradient-to-br from-purple-600 to-blue-500 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Optimize Your Listings?</h2>
          <p className="text-xl text-white/90 mb-8">
            Don't wait—get your first analysis free and see exactly what needs to change.
          </p>
          <a 
            href={`${config.customerCenterUrl}/signup`}
            className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 inline-block"
          >
            Start Free Analysis
          </a>
          <p className="text-white/80 mt-4">⚡ No credit card required</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default ContactPage;