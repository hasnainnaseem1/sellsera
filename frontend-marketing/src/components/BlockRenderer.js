import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useSite } from '../context/SiteContext';
import config from '../config';
import {
  Zap, Star, Shield, BarChart3, Upload, Clock, CheckCircle, ChevronDown, ChevronUp,
  Mail, MessageCircle, Phone, MapPin, Send, ArrowRight, Sparkles, Target, Users,
} from 'lucide-react';

// Icon mapping for dynamic icons
const iconMap = {
  zap: Zap, star: Star, shield: Shield, 'bar-chart': BarChart3,
  upload: Upload, clock: Clock, check: CheckCircle, mail: Mail,
  message: MessageCircle, phone: Phone, map: MapPin, send: Send,
  sparkles: Sparkles, target: Target, users: Users, arrow: ArrowRight,
};

const getIcon = (iconName, className = 'w-6 h-6') => {
  if (!iconName) return null;
  // If it looks like emoji (non-ASCII), render as text
  if (/[^\x00-\x7F]/.test(iconName)) {
    return <span className="text-2xl">{iconName}</span>;
  }
  const IconComponent = iconMap[iconName.toLowerCase()];
  if (IconComponent) return <IconComponent className={className} />;
  return <span className="text-2xl">{iconName}</span>;
};

// Helper: check if a signup/login link should be shown based on feature flags
const shouldShowAuthLink = (href, site) => {
  if (!href) return true;
  if (href.includes('/signup') && site?.enableCustomerSignup === false) return false;
  if (href.includes('/login') && site?.enableLogin === false) return false;
  return true;
};

// ─── HERO BLOCK ──────────────────────────────────────────────
const HeroBlock = ({ block }) => {
  const { site } = useSite();
  return (
    <section
      className="relative overflow-hidden"
      style={{
        backgroundColor: block.backgroundColor || '#f5f3ff',
        color: block.textColor || undefined,
        backgroundImage: block.backgroundImage ? `url(${block.backgroundImage})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
            {block.title || site.siteName}
          </h1>
          {block.subtitle && (
            <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto">
              {block.subtitle}
            </p>
          )}
          {block.content && (
            <p className="text-lg text-gray-500 mb-8">{block.content}</p>
          )}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {block.buttonText && shouldShowAuthLink(block.buttonLink || `${config.customerCenterUrl}/signup`, site) && (
              <a
                href={block.buttonLink || `${config.customerCenterUrl}/signup`}
                className="bg-gradient-to-r from-purple-600 to-blue-500 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-blue-600 transition-all transform hover:scale-105 shadow-lg hover:shadow-xl"
              >
                {block.buttonText}
              </a>
            )}
            {block.secondaryButtonText && shouldShowAuthLink(block.secondaryButtonLink || '/features', site) && (
              <a
                href={block.secondaryButtonLink || '/features'}
                className="border-2 border-purple-600 text-purple-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-purple-50 transition-all"
              >
                {block.secondaryButtonText}
              </a>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── FEATURES BLOCK ──────────────────────────────────────────
const FeaturesBlock = ({ block }) => (
  <section className="py-20" style={{ backgroundColor: block.backgroundColor || '#ffffff', color: block.textColor || undefined }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {block.title && (
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{block.title}</h2>
          {block.subtitle && <p className="text-xl text-gray-600 max-w-3xl mx-auto">{block.subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(block.items || []).map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-200">
            <div className="w-14 h-14 bg-purple-100 rounded-2xl flex items-center justify-center mb-6">
              {getIcon(item.icon, 'w-7 h-7 text-purple-600')}
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">{item.title}</h3>
            <p className="text-gray-600 leading-relaxed">{item.description}</p>
            {item.image && (
              <img src={item.image} alt={item.title} className="mt-4 rounded-lg w-full" />
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── PRICING BLOCK ───────────────────────────────────────────
const PricingBlock = ({ block }) => {
  const { site } = useSite();
  return (
  <section className="py-20" style={{ backgroundColor: block.backgroundColor || '#f9fafb', color: block.textColor || undefined }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {block.title && (
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{block.title}</h2>
          {block.subtitle && <p className="text-xl text-gray-600 max-w-3xl mx-auto">{block.subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
        {(block.items || []).map((plan, idx) => {
          const planHref = plan.link || `${config.customerCenterUrl}/signup`;
          return (
          <div
            key={idx}
            className={`rounded-2xl p-8 ${
              plan.highlighted
                ? 'bg-gradient-to-br from-purple-600 to-blue-500 text-white shadow-2xl scale-105 relative'
                : 'bg-white shadow-lg border border-gray-200'
            }`}
          >
            {plan.highlighted && (
              <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-yellow-400 text-gray-900 px-4 py-1 rounded-full text-sm font-bold">
                Popular
              </div>
            )}
            <h3 className={`text-xl font-bold mb-2 ${plan.highlighted ? 'text-white' : 'text-gray-900'}`}>{plan.title}</h3>
            <div className={`text-4xl font-bold mb-4 ${plan.highlighted ? 'text-white' : 'text-purple-600'}`}>
              {plan.price || 'Free'}
            </div>
            {plan.description && (
              <p className={`mb-6 ${plan.highlighted ? 'text-purple-100' : 'text-gray-500'}`}>{plan.description}</p>
            )}
            <ul className="space-y-3 mb-8">
              {(plan.features || []).map((feature, fidx) => (
                <li key={fidx} className="flex items-start gap-2">
                  <CheckCircle className={`w-5 h-5 mt-0.5 flex-shrink-0 ${plan.highlighted ? 'text-yellow-300' : 'text-green-500'}`} />
                  <span className={plan.highlighted ? 'text-purple-100' : 'text-gray-700'}>{feature}</span>
                </li>
              ))}
            </ul>
            {shouldShowAuthLink(planHref, site) && (
            <a
              href={planHref}
              className={`block w-full text-center py-3 rounded-xl font-semibold transition-all ${
                plan.highlighted
                  ? 'bg-white text-purple-600 hover:bg-gray-100'
                  : 'bg-purple-600 text-white hover:bg-purple-700'
              }`}
            >
              Get Started
            </a>
            )}
          </div>
          );
        })}
      </div>
    </div>
  </section>
  );
};

// ─── CTA BLOCK ───────────────────────────────────────────────
const CtaBlock = ({ block }) => {
  const { site } = useSite();
  return (
  <section
    className="py-20"
    style={{
      backgroundColor: block.backgroundColor || undefined,
      color: block.textColor || undefined,
      backgroundImage: block.backgroundImage ? `url(${block.backgroundImage})` : undefined,
      backgroundSize: 'cover',
    }}
  >
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
      {!block.backgroundColor && (
        <div className="bg-gradient-to-r from-purple-600 to-blue-500 rounded-3xl p-12 md:p-16 text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{block.title}</h2>
          {block.subtitle && <p className="text-xl text-purple-100 mb-8">{block.subtitle}</p>}
          {block.content && <p className="text-lg text-purple-100 mb-8">{block.content}</p>}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {block.buttonText && shouldShowAuthLink(block.buttonLink || `${config.customerCenterUrl}/signup`, site) && (
              <a
                href={block.buttonLink || `${config.customerCenterUrl}/signup`}
                className="bg-white text-purple-600 px-8 py-4 rounded-xl font-semibold text-lg hover:bg-gray-100 transition-all inline-block"
              >
                {block.buttonText}
              </a>
            )}
            {block.secondaryButtonText && shouldShowAuthLink(block.secondaryButtonLink || '#', site) && (
              <a
                href={block.secondaryButtonLink || '#'}
                className="border-2 border-white text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-white hover:bg-opacity-10 transition-all inline-block"
              >
                {block.secondaryButtonText}
              </a>
            )}
          </div>
        </div>
      )}
      {block.backgroundColor && (
        <>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">{block.title}</h2>
          {block.subtitle && <p className="text-xl opacity-80 mb-8">{block.subtitle}</p>}
          {block.content && <p className="text-lg opacity-80 mb-8">{block.content}</p>}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {block.buttonText && shouldShowAuthLink(block.buttonLink || `${config.customerCenterUrl}/signup`, site) && (
              <a href={block.buttonLink || `${config.customerCenterUrl}/signup`} className="bg-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg hover:bg-purple-700 transition-all inline-block">
                {block.buttonText}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  </section>
  );
};

// ─── FAQ BLOCK ───────────────────────────────────────────────
const FaqBlock = ({ block }) => {
  const [openIndex, setOpenIndex] = useState(null);
  return (
    <section className="py-20" style={{ backgroundColor: block.backgroundColor || '#ffffff', color: block.textColor || undefined }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {block.title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{block.title}</h2>
            {block.subtitle && <p className="text-xl text-gray-600">{block.subtitle}</p>}
          </div>
        )}
        <div className="space-y-4">
          {(block.items || []).map((item, idx) => (
            <div key={idx} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <button
                className="w-full flex justify-between items-center p-6 text-left hover:bg-gray-50 transition-colors"
                onClick={() => setOpenIndex(openIndex === idx ? null : idx)}
              >
                <span className="text-lg font-semibold text-gray-900">{item.title}</span>
                {openIndex === idx ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
              </button>
              {openIndex === idx && (
                <div className="px-6 pb-6 text-gray-600 leading-relaxed">
                  {item.description}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ─── TEXT / CONTENT BLOCK ────────────────────────────────────
const TextBlock = ({ block }) => (
  <section className="py-16" style={{ backgroundColor: block.backgroundColor || '#ffffff', color: block.textColor || undefined }}>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      {block.title && <h2 className="text-3xl font-bold text-gray-900 mb-4">{block.title}</h2>}
      {block.subtitle && <p className="text-xl text-gray-600 mb-6">{block.subtitle}</p>}
      {block.content && (
        <div className="prose prose-lg max-w-none text-gray-700 leading-relaxed whitespace-pre-line">
          {block.content}
        </div>
      )}
    </div>
  </section>
);

// ─── CONTACT BLOCK ───────────────────────────────────────────
const ContactBlock = ({ block }) => {
  const { site } = useSite();
  const [formData, setFormData] = useState({ name: '', email: '', subject: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    // In the future, this would POST to an API
    setSubmitted(true);
  };

  return (
    <section className="py-20" style={{ backgroundColor: block.backgroundColor || '#f9fafb', color: block.textColor || undefined }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {block.title && (
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{block.title}</h2>
            {block.subtitle && <p className="text-xl text-gray-600">{block.subtitle}</p>}
          </div>
        )}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div className="bg-white rounded-2xl shadow-lg p-8">
            {submitted ? (
              <div className="text-center py-12">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                <p className="text-gray-600">We'll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Name</label>
                  <input type="text" required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                  <input type="email" required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Subject</label>
                  <input type="text" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent" value={formData.subject} onChange={(e) => setFormData({ ...formData, subject: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Message</label>
                  <textarea rows={5} required className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none" value={formData.message} onChange={(e) => setFormData({ ...formData, message: e.target.value })} />
                </div>
                <button type="submit" className="w-full bg-gradient-to-r from-purple-600 to-blue-500 text-white py-4 rounded-xl font-semibold text-lg hover:from-purple-700 hover:to-blue-600 transition-all flex items-center justify-center gap-2">
                  <Send className="w-5 h-5" /> Send Message
                </button>
              </form>
            )}
          </div>
          <div className="space-y-6">
            {block.content && (
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{block.content}</p>
              </div>
            )}
            {site.contactEmail && (
              <div className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Mail className="w-6 h-6 text-purple-600" />
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Email</h4>
                  <a href={`mailto:${site.contactEmail}`} className="text-purple-600">{site.contactEmail}</a>
                </div>
              </div>
            )}
            {(block.items || []).map((item, idx) => (
              <div key={idx} className="bg-white rounded-2xl shadow-lg p-6 flex items-center gap-4">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  {getIcon(item.icon, 'w-6 h-6 text-purple-600')}
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">{item.title}</h4>
                  <p className="text-gray-600">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};

// ─── STATS BLOCK ─────────────────────────────────────────────
const StatsBlock = ({ block }) => (
  <section className="py-16" style={{ backgroundColor: block.backgroundColor || 'var(--color-primary)', color: block.textColor || '#ffffff' }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {block.title && <h2 className="text-3xl font-bold text-center mb-12">{block.title}</h2>}
      <div className={`grid grid-cols-2 md:grid-cols-${Math.min((block.items || []).length, 4)} gap-8`}>
        {(block.items || []).map((item, idx) => (
          <div key={idx} className="text-center">
            <div className="text-4xl md:text-5xl font-bold mb-2">{item.title}</div>
            <div className="text-lg opacity-80">{item.description}</div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── TESTIMONIALS BLOCK ──────────────────────────────────────
const TestimonialsBlock = ({ block }) => (
  <section className="py-20" style={{ backgroundColor: block.backgroundColor || '#ffffff', color: block.textColor || undefined }}>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {block.title && (
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">{block.title}</h2>
          {block.subtitle && <p className="text-xl text-gray-600">{block.subtitle}</p>}
        </div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {(block.items || []).map((item, idx) => (
          <div key={idx} className="bg-white rounded-2xl p-8 shadow-lg border border-gray-100">
            <div className="flex items-center gap-1 mb-4">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="w-5 h-5 text-yellow-400 fill-current" />
              ))}
            </div>
            <p className="text-gray-700 mb-6 leading-relaxed italic">"{item.description}"</p>
            <div className="flex items-center gap-3">
              {item.image ? (
                <img src={item.image} alt={item.title} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
                  <span className="text-purple-600 font-bold text-lg">{(item.title || '?')[0]}</span>
                </div>
              )}
              <div>
                <div className="font-semibold text-gray-900">{item.title}</div>
                {item.icon && <div className="text-sm text-gray-500">{item.icon}</div>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ─── CUSTOM HTML BLOCK ───────────────────────────────────────
const CustomBlock = ({ block }) => (
  <section style={{ backgroundColor: block.backgroundColor || undefined, color: block.textColor || undefined }}>
    <div dangerouslySetInnerHTML={{ __html: block.content || '' }} />
  </section>
);

// ─── BLOCK RENDERER ──────────────────────────────────────────
const blockComponents = {
  hero: HeroBlock,
  features: FeaturesBlock,
  pricing: PricingBlock,
  cta: CtaBlock,
  faq: FaqBlock,
  text: TextBlock,
  contact: ContactBlock,
  stats: StatsBlock,
  testimonials: TestimonialsBlock,
  custom: CustomBlock,
};

const BlockRenderer = ({ blocks = [] }) => {
  return (
    <>
      {blocks.map((block, idx) => {
        const Component = blockComponents[block.type];
        if (!Component) return null;
        return <Component key={block._id || idx} block={block} />;
      })}
    </>
  );
};

export default BlockRenderer;
