import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { Zap, Target, Copy, TrendingUp, Upload, BarChart3, CheckCircle, XCircle } from 'lucide-react';
import config from '../config';

function FeaturesPage() {
  const features = [
    {
      icon: <Zap className="w-12 h-12" />,
      title: "AI Analysis Engine",
      description: "Our AI doesn't just show you data—it tells you exactly what's wrong and how to fix it. Get specific, actionable recommendations in 30 seconds.",
      benefits: [
        "Analyzes your title, tags, description, and pricing",
        "Identifies exact keywords hurting your rankings",
        "Explains WHY your listing isn't converting",
        "No guesswork, no interpretation needed"
      ]
    },
    {
      icon: <Target className="w-12 h-12" />,
      title: "Competitor Intelligence",
      description: "We automatically find and analyze your top 5 competitors to show you what's actually working in your niche right now.",
      benefits: [
        "Discovers high-performing listings in your category",
        "Extracts winning keyword patterns",
        "Identifies pricing sweet spots",
        "Shows you gaps you can exploit"
      ]
    },
    {
      icon: <Copy className="w-12 h-12" />,
      title: "Copy-Paste Ready Improvements",
      description: "Stop wasting time rewriting. Every suggestion comes ready to copy and paste directly into your listing.",
      benefits: [
        "Exact title replacements (not suggestions)",
        "Specific tag recommendations with reasoning",
        "Rewritten descriptions optimized for buyers",
        "Pricing adjustments with competitor context"
      ]
    },
    {
      icon: <TrendingUp className="w-12 h-12" />,
      title: "Weekly Monitoring",
      description: "Set it and forget it. We track your listings daily and alert you when something needs attention.",
      benefits: [
        "Daily ranking position tracking",
        "Competitor price movement alerts",
        "Keyword decay detection",
        "Automatic performance reports via email"
      ]
    },
    {
      icon: <Upload className="w-12 h-12" />,
      title: "Bulk CSV Upload",
      description: "Got 50+ listings? Upload them all at once. We'll analyze your entire shop and prioritize which listings need fixes first.",
      benefits: [
        "Analyze up to 250 listings simultaneously",
        "Priority ranking of listings needing attention",
        "Batch export of all recommendations",
        "Shop-wide performance overview"
      ]
    },
    {
      icon: <BarChart3 className="w-12 h-12" />,
      title: "Advanced Analytics",
      description: "Track your improvements over time. See which changes actually moved the needle on your sales.",
      benefits: [
        "Before/after comparison for each listing",
        "Historical ranking data",
        "ROI tracking on optimizations",
        "Export all data to CSV/JSON"
      ]
    }
  ];

  const comparisonPoints = [
    {
      other: "Show you confusing charts and graphs",
      us: "Tell you EXACTLY what to change"
    },
    {
      other: "Make YOU figure out what to change",
      us: "Copy-paste ready titles, tags, descriptions"
    },
    {
      other: "Give vague suggestions like 'improve SEO'",
      us: "Specific pricing recommendations"
    },
    {
      other: "Require hours of learning and analysis",
      us: "Get results in 30 seconds, not 30 minutes"
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-purple-600 to-blue-500 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-block bg-white/20 backdrop-blur-sm px-4 py-2 rounded-full text-sm mb-6">
            ⚡ AI-Powered Optimization
          </div>
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            Features That Actually
            <br />
            <span className="text-yellow-300">Increase Sales</span>
          </h1>
          <p className="text-xl text-white/90 max-w-3xl mx-auto mb-8">
            Stop analyzing data. Start getting exact, copy-paste ready improvements
            that your competitors don't want you to know about.
          </p>
          <a 
            href={`${config.customerCenterUrl}/signup`}
            className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 inline-flex items-center gap-2"
          >
            Try It Free <span className="text-2xl">→</span>
          </a>
          <p className="text-white/80 mt-4">⚡ 1 free analysis • No credit card required</p>
        </div>
      </div>

      {/* Comparison Section */}
      <div className="py-16 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Tired of Complicated SEO Tools?</h2>
            <p className="text-xl text-gray-600">
              Other tools give you data. We give you <span className="text-purple-600 font-semibold">exact actions to take</span>.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Other Tools */}
            <div className="bg-white rounded-2xl p-8 border-2 border-red-200">
              <div className="flex items-center gap-3 mb-6">
                <XCircle className="w-8 h-8 text-red-500" />
                <h3 className="text-2xl font-bold text-gray-800">Other Tools</h3>
              </div>
              <ul className="space-y-4">
                {comparisonPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-600">
                    <span className="text-red-500 text-xl">•</span>
                    <span>{point.other}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Sellsera */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-2xl p-8 border-2 border-purple-300">
              <div className="flex items-center gap-3 mb-6">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <h3 className="text-2xl font-bold text-purple-600">Sellsera</h3>
              </div>
              <ul className="space-y-4">
                {comparisonPoints.map((point, index) => (
                  <li key={index} className="flex items-start gap-3 text-gray-700">
                    <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={20} />
                    <span className="font-medium">{point.us}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">Everything You Need to Grow</h2>
            <p className="text-xl text-gray-600">
              Six powerful features designed to increase your sales
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div key={index} className="bg-white rounded-2xl p-8 border border-gray-200 hover:border-purple-300 hover:shadow-xl transition-all">
                <div className="text-purple-600 mb-4">
                  {feature.icon}
                </div>
                <h3 className="text-2xl font-bold mb-3 text-gray-800">{feature.title}</h3>
                <p className="text-gray-600 mb-6">{feature.description}</p>
                <ul className="space-y-3">
                  {feature.benefits.map((benefit, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-sm text-gray-600">
                      <CheckCircle className="text-green-500 flex-shrink-0 mt-0.5" size={16} />
                      <span>{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="py-20 bg-gradient-to-br from-purple-600 to-blue-500 text-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-white/90">Three simple steps to better listings</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">Paste Your Listing</h3>
              <p className="text-white/80">Copy your title, description, tags, and price into our analyzer</p>
            </div>

            <div className="text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">AI Analyzes</h3>
              <p className="text-white/80">Our AI finds your competitors and diagnoses exactly what's wrong in 30 seconds</p>
            </div>

            <div className="text-center">
              <div className="bg-white/10 backdrop-blur-sm rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 text-3xl font-bold">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">Copy & Paste Fixes</h3>
              <p className="text-white/80">Get exact replacements ready to paste directly into your listing</p>
            </div>
          </div>

          <div className="text-center mt-12">
            <a 
              href={`${config.customerCenterUrl}/signup`}
              className="bg-white text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-gray-100 inline-flex items-center gap-2"
            >
              Start Your Free Analysis <span className="text-2xl">→</span>
            </a>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl font-bold mb-6">Ready to Stop Analyzing and Start Selling?</h2>
          <p className="text-xl text-gray-600 mb-8">
            Join users who are getting exact, actionable recommendations
            instead of confusing charts and graphs.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href={`${config.customerCenterUrl}/signup`}
              className="bg-purple-600 text-white px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-700"
            >
              Get Started Free
            </a>
            <Link 
              to="/pricing"
              className="border-2 border-purple-600 text-purple-600 px-8 py-4 rounded-lg text-lg font-semibold hover:bg-purple-50"
            >
              See Pricing
            </Link>
          </div>
          <p className="text-gray-500 mt-4">⚡ 1 free analysis • No credit card required</p>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default FeaturesPage;