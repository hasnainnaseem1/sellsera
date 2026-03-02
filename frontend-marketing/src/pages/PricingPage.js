import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { CheckCircle, X } from 'lucide-react';
import config from '../config';

function PricingPage() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [billingCycle, setBillingCycle] = useState('monthly');

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const res = await fetch(`${config.apiUrl}/api/v1/public/plans`);
      const data = await res.json();
      if (data.success) {
        setPlans(data.plans || []);
      }
    } catch (err) {
      console.error('Failed to fetch plans:', err);
    } finally {
      setLoading(false);
    }
  };

  const getPrice = (plan) => {
    if (!plan.price) return 0;
    return billingCycle === 'yearly'
      ? (plan.price.yearly || 0)
      : (plan.price.monthly || 0);
  };

  const isPopular = (plan) =>
    plan.metadata?.popular || plan.name.toLowerCase() === 'pro';

  const isFree = (plan) => getPrice(plan) === 0;

  return (
    <div className="bg-white">
      <Navbar />
      
      {/* Header */}
      <section className="bg-gradient-to-br from-purple-600 to-blue-600 text-white py-20">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <h1 className="text-5xl font-bold mb-6">
            Simple, Transparent Pricing
          </h1>
          <p className="text-xl text-purple-100 max-w-2xl mx-auto mb-8">
            Choose the plan that fits your needs. All plans include our core AI optimization features.
          </p>

          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-4">
            <span className={`text-lg font-semibold ${billingCycle === 'monthly' ? 'text-white' : 'text-purple-200'}`}>
              Monthly
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'yearly' : 'monthly')}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                billingCycle === 'yearly' ? 'bg-yellow-400' : 'bg-purple-400'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  billingCycle === 'yearly' ? 'translate-x-7' : 'translate-x-0'
                }`}
              />
            </button>
            <span className={`text-lg font-semibold ${billingCycle === 'yearly' ? 'text-white' : 'text-purple-200'}`}>
              Yearly
            </span>
            {billingCycle === 'yearly' && (
              <span className="bg-yellow-400 text-purple-900 text-xs font-bold px-3 py-1 rounded-full">
                Save up to 20%
              </span>
            )}
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4">
          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block w-8 h-8 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin" />
              <p className="text-gray-500 mt-4">Loading plans...</p>
            </div>
          ) : plans.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-gray-500 text-lg">No plans available at the moment.</p>
            </div>
          ) : (
            <div className={`grid gap-8 max-w-6xl mx-auto ${
              plans.length === 1 ? 'md:grid-cols-1 max-w-md' :
              plans.length === 2 ? 'md:grid-cols-2 max-w-2xl' :
              plans.length === 3 ? 'md:grid-cols-3 max-w-4xl' :
              'md:grid-cols-4'
            }`}>
              {plans.map((plan) => {
                const price = getPrice(plan);
                const popular = isPopular(plan);
                const free = isFree(plan);

                return (
                  <div
                    key={plan._id}
                    className={`rounded-xl shadow-xl p-8 relative ${
                      popular
                        ? 'bg-gradient-to-br from-purple-600 to-blue-600 border-4 border-yellow-400 transform scale-105'
                        : 'bg-white border-2 border-gray-200'
                    }`}
                  >
                    {popular && (
                      <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                        <span className="bg-yellow-400 text-purple-900 text-xs font-bold px-4 py-1 rounded-full">
                          MOST POPULAR
                        </span>
                      </div>
                    )}

                    <h3 className={`text-2xl font-bold mb-2 ${popular ? 'text-white' : 'text-gray-900'}`}>
                      {plan.name}
                    </h3>

                    <div className="mb-6">
                      <span className={`text-5xl font-bold ${popular ? 'text-white' : 'text-gray-900'}`}>
                        ${price}
                      </span>
                      {!free && (
                        <span className={`text-xl ${popular ? 'text-purple-200' : 'text-gray-600'}`}>
                          /{billingCycle === 'yearly' ? 'year' : 'month'}
                        </span>
                      )}
                    </div>

                    {plan.description && (
                      <p className={`mb-8 ${popular ? 'text-purple-100' : 'text-gray-600'}`}>
                        {plan.description}
                      </p>
                    )}

                    {plan.trialDays > 0 && (
                      <p className={`text-sm font-semibold mb-4 ${popular ? 'text-yellow-300' : 'text-purple-600'}`}>
                        {plan.trialDays}-day free trial
                      </p>
                    )}

                    <ul className="space-y-4 mb-8">
                      {(plan.features || []).map((f, i) => (
                        <li key={i} className="flex items-start">
                          {f.enabled ? (
                            <CheckCircle className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                              popular ? 'text-yellow-300' : 'text-green-500'
                            }`} />
                          ) : (
                            <X className={`w-5 h-5 mr-3 mt-0.5 flex-shrink-0 ${
                              popular ? 'text-purple-300 opacity-50' : 'text-gray-300'
                            }`} />
                          )}
                          <span className={
                            f.enabled
                              ? (popular ? 'text-white' : 'text-gray-700')
                              : (popular ? 'text-purple-300 opacity-50' : 'text-gray-400')
                          }>
                            {f.featureName}
                            {f.limit !== null && f.limit !== undefined && f.enabled && (
                              <span className="font-bold">
                                {' '}({f.limit === -1 ? 'Unlimited' : f.limit})
                              </span>
                            )}
                          </span>
                        </li>
                      ))}
                    </ul>

                    <a
                      href={`${config.customerCenterUrl}/signup`}
                      className={`block text-center py-3 rounded-lg font-bold transition ${
                        popular
                          ? 'bg-white text-purple-600 hover:bg-purple-50'
                          : free
                            ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                            : 'bg-purple-600 hover:bg-purple-700 text-white'
                      }`}
                    >
                      {free ? 'Get Started' : 'Start Free Trial'}
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4">
          <h2 className="text-3xl font-bold text-gray-900 text-center mb-12">
            Frequently Asked Questions
          </h2>
          
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Can I cancel anytime?
              </h3>
              <p className="text-gray-600">
                Yes! You can cancel your subscription at any time. No questions asked.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                What payment methods do you accept?
              </h3>
              <p className="text-gray-600">
                We accept all major credit cards (Visa, Mastercard, American Express) through Stripe.
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Do unused analyses roll over?
              </h3>
              <p className="text-gray-600">
                No, analyses reset monthly. But you can always upgrade to a higher plan if you need more!
              </p>
            </div>

            <div className="bg-white p-6 rounded-lg shadow">
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                Is there a free trial?
              </h3>
              <p className="text-gray-600">
                Yes! All paid plans come with a free trial. No credit card required for the Free plan.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

export default PricingPage;
