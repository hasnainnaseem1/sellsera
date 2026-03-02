import React from 'react';
import { Link } from 'react-router-dom';
import { Zap, Mail, Twitter, Linkedin, Facebook, Instagram, Youtube } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import config from '../config';

function Footer() {
  const { site, navigation, pages, seo, loading } = useSite();
  const brandName = site.companyName || site.siteName || '';
  const year = new Date().getFullYear();
  const socialLinks = seo?.socialLinks || {};
  const socialEnabled = seo?.socialLinksEnabled || {};
  const customSocialLinks = seo?.customSocialLinks || [];

  // Split navigation into product links (non-legal pages)
  const productLinks = navigation.filter(n => !['privacy', 'terms'].includes(n.slug));
  // Legal links — pull from ALL pages (they may have showInNavigation: false)
  const legalLinks = pages
    .filter(p => ['privacy', 'terms'].includes(p.slug))
    .map(p => ({ slug: p.slug, label: p.title, path: `/${p.slug}` }));

  if (loading) return null;

  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-4">
              {site.logoUrl ? (
                <img src={site.logoUrl} alt={brandName} className="h-8 w-auto" />
              ) : (
                <Zap className="w-8 h-8 text-purple-500" />
              )}
              <span className="text-2xl font-bold text-white">
                {brandName}
              </span>
            </div>
            <p className="text-gray-400 mb-4 max-w-md">
              {site.appDescription || site.siteDescription || ''}
            </p>
            <div className="flex space-x-4">
              {site.contactEmail && (
                <a href={`mailto:${site.contactEmail}`} className="text-gray-400 hover:text-purple-500 transition" aria-label="Email">
                  <Mail className="w-5 h-5" />
                </a>
              )}
              {socialLinks.twitter && socialEnabled.twitter !== false && (
                <a href={socialLinks.twitter.startsWith('@') ? `https://twitter.com/${socialLinks.twitter.slice(1)}` : socialLinks.twitter} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label="Twitter">
                  <Twitter className="w-5 h-5" />
                </a>
              )}
              {socialLinks.facebook && socialEnabled.facebook !== false && (
                <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label="Facebook">
                  <Facebook className="w-5 h-5" />
                </a>
              )}
              {socialLinks.linkedin && socialEnabled.linkedin !== false && (
                <a href={socialLinks.linkedin} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label="LinkedIn">
                  <Linkedin className="w-5 h-5" />
                </a>
              )}
              {socialLinks.instagram && socialEnabled.instagram !== false && (
                <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label="Instagram">
                  <Instagram className="w-5 h-5" />
                </a>
              )}
              {socialLinks.youtube && socialEnabled.youtube !== false && (
                <a href={socialLinks.youtube} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label="YouTube">
                  <Youtube className="w-5 h-5" />
                </a>
              )}
              {customSocialLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-purple-500 transition" aria-label={link.name}>
                  {link.iconUrl ? (
                    <img src={link.iconUrl} alt={link.name} className="w-5 h-5 rounded-sm object-cover" />
                  ) : (
                    <span className="text-xs font-medium">{link.name?.charAt(0)?.toUpperCase()}</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Product Navigation */}
          <div>
            <h3 className="text-white font-semibold mb-4">Product</h3>
            <ul className="space-y-2">
              {productLinks.map((item) => (
                <li key={item.slug}>
                  <Link to={item.path} className="text-gray-400 hover:text-purple-500 transition">
                    {item.label}
                  </Link>
                </li>
              ))}
              {site.enableCustomerSignup && (
                <li>
                  <a href={`${config.customerCenterUrl}/signup`} className="text-gray-400 hover:text-purple-500 transition">
                    Get Started
                  </a>
                </li>
              )}
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h3 className="text-white font-semibold mb-4">Legal</h3>
            <ul className="space-y-2">
              {legalLinks.map((item) => (
                <li key={item.slug}>
                  <Link to={item.path} className="text-gray-400 hover:text-purple-500 transition">
                    {item.label}
                  </Link>
                </li>
              ))}
              {/* Always show contact if there's a contact email */}
              {site.contactEmail && !navigation.some(n => n.slug === 'contact') && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="text-gray-400 hover:text-purple-500 transition">
                    Contact Us
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-500 text-sm">
          <p>&copy; {year} {brandName}. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer;