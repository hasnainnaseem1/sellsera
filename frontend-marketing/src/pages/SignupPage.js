import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, EyeOff, UserPlus, Zap, ArrowRight, Check } from 'lucide-react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSite } from '../context/SiteContext';
import config from '../config';

const SignupPage = () => {
  const { site } = useSite();
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const brandName = site.companyName || site.siteName || '';

  const benefits = [
    'Free plan available — no credit card required',
    'Set up in under 2 minutes',
    'Upgrade anytime to unlock more features',
    'Cancel or change your plan anytime',
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Redirect to the actual customer app signup
    window.location.href = `${config.customerCenterUrl}/signup`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-4 py-12 sm:py-20">
        <div className="w-full max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — Benefits Panel */}
            <div className="hidden lg:block">
              <div className="relative">
                {/* Decorative gradient blobs */}
                <div className="absolute -top-12 -left-12 w-72 h-72 bg-purple-200 rounded-full opacity-30 blur-3xl" />
                <div className="absolute -bottom-12 -right-8 w-56 h-56 bg-blue-200 rounded-full opacity-30 blur-3xl" />

                <div className="relative">
                  <div className="inline-flex items-center gap-2 mb-6">
                    {site.logoUrl ? (
                      <img src={site.logoUrl} alt={brandName} className="h-10 w-auto" />
                    ) : (
                      <Zap className="w-10 h-10 text-purple-600" />
                    )}
                    <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
                      {brandName}
                    </span>
                  </div>

                  <h2 className="text-3xl xl:text-4xl font-bold text-gray-900 mb-4 leading-tight">
                    Start growing your business today
                  </h2>
                  <p className="text-lg text-gray-500 mb-8">
                    {site.appDescription || site.siteDescription || `Join thousands of professionals using ${brandName} to optimize their workflow.`}
                  </p>

                  <ul className="space-y-4">
                    {benefits.map((benefit, idx) => (
                      <li key={idx} className="flex items-start gap-3">
                        <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                          <Check className="w-4 h-4 text-green-600" />
                        </div>
                        <span className="text-gray-700">{benefit}</span>
                      </li>
                    ))}
                  </ul>

                  {/* Social proof */}
                  <div className="mt-10 pt-8 border-t border-gray-200">
                    <div className="flex items-center gap-4">
                      <div className="flex -space-x-2">
                        {[...Array(4)].map((_, i) => (
                          <div
                            key={i}
                            className="w-10 h-10 rounded-full border-2 border-white bg-gradient-to-br from-purple-400 to-blue-400 flex items-center justify-center text-white text-xs font-bold"
                          >
                            {String.fromCharCode(65 + i)}
                          </div>
                        ))}
                      </div>
                      <div>
                        <div className="flex items-center gap-1">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} className="w-4 h-4 text-yellow-400 fill-current" viewBox="0 0 20 20">
                              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                            </svg>
                          ))}
                        </div>
                        <p className="text-sm text-gray-500 mt-0.5">Loved by 1,000+ users</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right — Form */}
            <div className="w-full max-w-md mx-auto lg:mx-0">
              {/* Mobile Header */}
              <div className="text-center mb-8 lg:hidden">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-blue-500 shadow-lg shadow-purple-200 mb-6">
                  {site.logoSmallUrl ? (
                    <img src={site.logoSmallUrl} alt={brandName} className="w-10 h-10 object-contain" />
                  ) : (
                    <Zap className="w-8 h-8 text-white" />
                  )}
                </div>
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h1>
                <p className="text-gray-500">Start your journey with {brandName}</p>
              </div>

              {/* Desktop Header */}
              <div className="hidden lg:block mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Create your account</h1>
                <p className="text-gray-500">It's free to get started</p>
              </div>

              {/* Card */}
              <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-8">
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Name */}
                  <div>
                    <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
                      Full name
                    </label>
                    <input
                      id="name"
                      type="text"
                      required
                      autoComplete="name"
                      placeholder="John Doe"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                      Email address
                    </label>
                    <input
                      id="email"
                      type="email"
                      required
                      autoComplete="email"
                      placeholder="you@example.com"
                      className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>

                  {/* Password */}
                  <div>
                    <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoComplete="new-password"
                        placeholder="Min. 8 characters"
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent focus:bg-white transition-all duration-200 pr-12"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>

                  {/* Password Strength Indicator */}
                  {formData.password && (
                    <div className="space-y-2">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map((level) => {
                          const strength = formData.password.length >= 12 ? 4
                            : formData.password.length >= 10 ? 3
                            : formData.password.length >= 8 ? 2 : 1;
                          return (
                            <div
                              key={level}
                              className={`h-1.5 flex-1 rounded-full transition-colors ${
                                level <= strength
                                  ? strength <= 1 ? 'bg-red-400'
                                  : strength === 2 ? 'bg-yellow-400'
                                  : strength === 3 ? 'bg-blue-400'
                                  : 'bg-green-400'
                                  : 'bg-gray-200'
                              }`}
                            />
                          );
                        })}
                      </div>
                      <p className="text-xs text-gray-400">
                        {formData.password.length < 8 ? 'Too short' :
                          formData.password.length < 10 ? 'Fair' :
                          formData.password.length < 12 ? 'Good' : 'Strong'}
                      </p>
                    </div>
                  )}

                  {/* Terms */}
                  <div className="flex items-start gap-2">
                    <input
                      id="agree"
                      type="checkbox"
                      required
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                      className="w-4 h-4 mt-0.5 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                    />
                    <label htmlFor="agree" className="text-sm text-gray-500 leading-snug">
                      I agree to the{' '}
                      <Link to="/terms" className="text-purple-600 hover:text-purple-700 font-medium">
                        Terms of Service
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="text-purple-600 hover:text-purple-700 font-medium">
                        Privacy Policy
                      </Link>
                    </label>
                  </div>

                  {/* Submit */}
                  <button
                    type="submit"
                    disabled={loading || !agreed}
                    className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white py-3.5 rounded-xl font-semibold text-base hover:from-purple-700 hover:to-blue-600 transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-purple-200 flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {loading ? (
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <UserPlus className="w-5 h-5" />
                        Create account
                      </>
                    )}
                  </button>
                </form>

                {/* Divider */}
                <div className="relative my-8">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-gray-200" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="bg-white px-4 text-gray-400">or sign up with</span>
                  </div>
                </div>

                {/* Social buttons */}
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all"
                    onClick={() => window.location.href = `${config.customerCenterUrl}/signup`}
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    Google
                  </button>
                  <button
                    type="button"
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-100 transition-all"
                    onClick={() => window.location.href = `${config.customerCenterUrl}/signup`}
                  >
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0012 2z"/></svg>
                    GitHub
                  </button>
                </div>
              </div>

              {/* Login link */}
              <p className="text-center mt-8 text-gray-500">
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold text-purple-600 hover:text-purple-700 transition-colors inline-flex items-center gap-1"
                >
                  Sign in <ArrowRight className="w-4 h-4" />
                </Link>
              </p>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default SignupPage;
