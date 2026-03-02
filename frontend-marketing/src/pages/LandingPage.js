import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Zap, ArrowRight, CheckCircle, Copy, Target, Clock } from 'lucide-react';
import config from '../config';

function LandingPage() {
  return (
    <div>
      <Navbar />

      {/* Hero Section */}
      <section className="bg-gradient-to-br from-purple-600 via-blue-600 to-purple-700 text-white">
        <div className="max-w-7xl mx-auto px-4 py-20 md:py-32">
          <div className="text-center">
            <div className="inline-flex items-center bg-white/20 rounded-full px-4 py-2 mb-8">
              <Zap className="w-4 h-4 mr-2 text-yellow-300" />
              <span className="text-sm font-semibold">AI-Powered Optimization</span>
            </div>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              Stop Analyzing.<br />
              <span className="text-yellow-300">Start Selling.</span>
            </h1>
            
            <p className="text-xl md:text-2xl mb-8 text-purple-100 max-w-3xl mx-auto">
              Get exact, copy-paste ready improvements for your listings in 30 seconds.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <a 
                href={`${config.customerCenterUrl}/signup`}
                className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-purple-50 transition shadow-xl inline-flex items-center justify-center"
              >
                Get Started Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </a>
              
              <a 
                href="#how-it-works"
                className="bg-purple-700 text-white px-8 py-4 rounded-lg text-lg font-bold hover:bg-purple-800 transition border-2 border-purple-400 inline-flex items-center justify-center"
              >
                See How It Works
              </a>
            </div>

            <div className="text-purple-200 text-sm">
              ✨ <strong>1 free analysis</strong> • No credit card required
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Tired of Complicated SEO Tools?
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Other tools give you data. We give you <strong>exact actions to take</strong>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <div className="bg-white p-8 rounded-xl shadow-sm border-2 border-gray-200">
              <div className="text-red-600 font-bold mb-4 flex items-center">
                <span className="text-2xl mr-2">❌</span>
                Other Tools
              </div>
              <ul className="space-y-3 text-gray-600">
                <li>• Show you confusing charts and graphs</li>
                <li>• Make YOU figure out what to change</li>
                <li>• Give vague suggestions like "improve SEO"</li>
                <li>• Require hours of learning and analysis</li>
              </ul>
            </div>

            <div className="bg-gradient-to-br from-purple-50 to-blue-50 p-8 rounded-xl shadow-lg border-2 border-purple-300">
              <div className="text-purple-600 font-bold mb-4 flex items-center">
                <span className="text-2xl mr-2">✅</span>
                Sellsera
              </div>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Tells you EXACTLY what to change
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Copy-paste ready titles, tags, descriptions
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Specific pricing recommendations
                </li>
                <li className="flex items-start">
                  <CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5 flex-shrink-0" />
                  Get results in 30 seconds, not 30 minutes
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              What Makes Us Different
            </h2>
            <p className="text-xl text-gray-600">
              AI-powered insights that actually help you sell more
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="bg-purple-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Copy className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Copy-Paste Ready
              </h3>
              <p className="text-gray-600">
                Every suggestion comes with exact text you can copy and paste directly into your listing.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="bg-blue-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Target className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Competitor Intelligence
              </h3>
              <p className="text-gray-600">
                We analyze what's working for your competitors and tell you exactly how to compete.
              </p>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg hover:shadow-xl transition">
              <div className="bg-green-100 w-16 h-16 rounded-lg flex items-center justify-center mb-6">
                <Clock className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                30 Second Analysis
              </h3>
              <p className="text-gray-600">
                Paste your listing details, click analyze, and get instant recommendations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-600">
              Three simple steps to better listings
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="bg-purple-600 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6 shadow-lg">
                1
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Paste Your Listing
              </h3>
              <p className="text-gray-600">
                Copy your listing details - title, tags, price, description.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-blue-600 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6 shadow-lg">
                2
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                AI Analyzes
              </h3>
              <p className="text-gray-600">
                Our AI compares against competitors and finds gaps.
              </p>
            </div>

            <div className="text-center">
              <div className="bg-green-600 w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white mx-auto mb-6 shadow-lg">
                3
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">
                Copy & Update
              </h3>
              <p className="text-gray-600">
                Get exact text to copy-paste. Update your listing. See sales increase.
              </p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a 
              href={`${config.customerCenterUrl}/signup`}
              className="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg text-lg font-bold hover:shadow-xl transition inline-flex items-center"
            >
              Try It Free Now
              <ArrowRight className="w-5 h-5 ml-2" />
            </a>
          </div>
        </div>
      </section>

      {/* Pricing Teaser */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-xl text-gray-600 mb-8">
              Start free, upgrade when you need more
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {/* Free */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Free</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">$0</span>
              </div>
              <p className="text-gray-600 mb-6">Try it out</p>
              <ul className="space-y-3 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  1 analysis
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  All features
                </li>
              </ul>
              <a 
                href={`${config.customerCenterUrl}/signup`}
                className="block text-center bg-gray-100 hover:bg-gray-200 text-gray-900 py-2 rounded-lg font-semibold transition"
              >
                Get Started
              </a>
            </div>

            {/* Starter */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-purple-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">$19</span>
                <span className="text-gray-600">/mo</span>
              </div>
              <p className="text-gray-600 mb-6">For beginners</p>
              <ul className="space-y-3 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  50 analyses/month
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Save history
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Email support
                </li>
              </ul>
              <a 
                href={`${config.customerCenterUrl}/signup`}
                className="block text-center bg-purple-600 hover:bg-purple-700 text-white py-2 rounded-lg font-semibold transition"
              >
                Start Free Trial
              </a>
            </div>

            {/* Pro */}
            <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-xl shadow-2xl border-2 border-purple-400 transform md:scale-105">
              <div className="bg-yellow-400 text-purple-900 text-xs font-bold px-3 py-1 rounded-full inline-block mb-3">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-white">$49</span>
                <span className="text-purple-200">/mo</span>
              </div>
              <p className="text-purple-100 mb-6">For growing shops</p>
              <ul className="space-y-3 mb-6 text-sm text-white">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-yellow-300 mr-2" />
                  250 analyses/month
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-yellow-300 mr-2" />
                  Weekly monitoring
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-yellow-300 mr-2" />
                  Priority support
                </li>
              </ul>
              <a 
                href={`${config.customerCenterUrl}/signup`}
                className="block text-center bg-white text-purple-600 py-2 rounded-lg font-semibold hover:bg-purple-50 transition"
              >
                Start Free Trial
              </a>
            </div>

            {/* Unlimited */}
            <div className="bg-white p-6 rounded-xl shadow-lg border-2 border-gray-200">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Unlimited</h3>
              <div className="mb-4">
                <span className="text-4xl font-bold text-gray-900">$79</span>
                <span className="text-gray-600">/mo</span>
              </div>
              <p className="text-gray-600 mb-6">For power users</p>
              <ul className="space-y-3 mb-6 text-sm text-gray-600">
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  Unlimited analyses
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  API access
                </li>
                <li className="flex items-center">
                  <CheckCircle className="w-4 h-4 text-green-500 mr-2" />
                  White-label option
                </li>
              </ul>
              <Link 
                to="/contact" 
                className="block text-center bg-gray-900 hover:bg-gray-800 text-white py-2 rounded-lg font-semibold transition"
              >
                Contact Sales
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-purple-600 to-blue-600 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to Increase Your Sales?
          </h2>
          <p className="text-xl mb-8 text-purple-100">
            Join hundreds of users who have optimized their listings with AI
          </p>
          <a 
            href={`${config.customerCenterUrl}/signup`}
            className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-bold hover:bg-purple-50 transition shadow-xl inline-flex items-center"
          >
            Get Your Free Analysis
            <ArrowRight className="w-5 h-5 ml-2" />
          </a>
          <p className="text-purple-200 text-sm mt-4">
            No credit card required • Takes 30 seconds
          </p>
        </div>
      </section>

      <Footer />
    </div>    
  );
}

export default LandingPage;