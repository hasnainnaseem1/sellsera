import React from 'react';
import { Link } from 'react-router-dom';
import { Mail, Twitter, Linkedin, Facebook, Instagram, Youtube } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import SellseraLogo from './SellseraLogo';
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

  const socialIcons = [
    { key: 'twitter',   Icon: Twitter,   url: socialLinks.twitter?.startsWith('@') ? `https://twitter.com/${socialLinks.twitter.slice(1)}` : socialLinks.twitter },
    { key: 'facebook',  Icon: Facebook,  url: socialLinks.facebook },
    { key: 'linkedin',  Icon: Linkedin,  url: socialLinks.linkedin },
    { key: 'instagram', Icon: Instagram, url: socialLinks.instagram },
    { key: 'youtube',   Icon: Youtube,   url: socialLinks.youtube },
  ].filter(s => s.url && socialEnabled[s.key] !== false);

  return (
    <footer className="bg-gray-950 text-gray-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 mb-12">

          {/* Brand column */}
          <div className="md:col-span-5">
            <div className="mb-4">
              {site.logoUrl ? (
                <span className="inline-flex items-center gap-2.5">
                  <img src={site.logoUrl} alt={brandName} className="h-8 w-auto" />
                  <span className="text-xl font-bold text-white">{brandName}</span>
                </span>
              ) : (
                <SellseraLogo size={32} showText darkBg />
              )}
            </div>
            <p className="text-gray-500 text-sm leading-relaxed mb-6 max-w-sm">
              {site.appDescription || site.siteDescription || ''}
            </p>
            <div className="flex items-center gap-3">
              {site.contactEmail && (
                <a href={`mailto:${site.contactEmail}`} className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors" aria-label="Email">
                  <Mail className="w-4 h-4 text-gray-400" />
                </a>
              )}
              {socialIcons.map(({ key, Icon, url }) => (
                <a key={key} href={url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors" aria-label={key}>
                  <Icon className="w-4 h-4 text-gray-400" />
                </a>
              ))}
              {customSocialLinks.map((link, i) => (
                <a key={i} href={link.url} target="_blank" rel="noopener noreferrer" className="w-9 h-9 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center transition-colors" aria-label={link.name}>
                  {link.iconUrl ? (
                    <img src={link.iconUrl} alt={link.name} className="w-4 h-4 rounded-sm object-cover" />
                  ) : (
                    <span className="text-xs font-bold text-gray-400">{link.name?.charAt(0)?.toUpperCase()}</span>
                  )}
                </a>
              ))}
            </div>
          </div>

          {/* Product navigation */}
          <div className="md:col-span-3">
            <h4 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Product</h4>
            <ul className="space-y-2.5">
              {productLinks.map((item) => (
                <li key={item.slug}>
                  <Link to={item.path} className="text-sm text-gray-500 hover:text-white transition-colors">{item.label}</Link>
                </li>
              ))}
              {site.enableCustomerSignup && (
                <li>
                  <a href={`${config.customerCenterUrl}/signup`} className="text-sm text-gray-500 hover:text-white transition-colors">Get Started</a>
                </li>
              )}
            </ul>
          </div>

          {/* Legal */}
          <div className="md:col-span-2">
            <h4 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Legal</h4>
            <ul className="space-y-2.5">
              {legalLinks.map((item) => (
                <li key={item.slug}>
                  <Link to={item.path} className="text-sm text-gray-500 hover:text-white transition-colors">{item.label}</Link>
                </li>
              ))}
              {site.contactEmail && !navigation.some(n => n.slug === 'contact') && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="text-sm text-gray-500 hover:text-white transition-colors">Contact</a>
                </li>
              )}
            </ul>
          </div>

          {/* Support */}
          <div className="md:col-span-2">
            <h4 className="text-white text-sm font-semibold uppercase tracking-wider mb-4">Support</h4>
            <ul className="space-y-2.5">
              {site.contactEmail && (
                <li>
                  <a href={`mailto:${site.contactEmail}`} className="text-sm text-gray-500 hover:text-white transition-colors">Email Support</a>
                </li>
              )}
              {navigation.some(n => n.slug === 'blog') && (
                <li>
                  <Link to="/blog" className="text-sm text-gray-500 hover:text-white transition-colors">Blog</Link>
                </li>
              )}
            </ul>
          </div>
        </div>

        {/* Divider + bottom */}
        <div className="border-t border-gray-800 pt-8 flex flex-col gap-3">
          {/* Etsy Required Trademark Disclosure */}
          <p className="text-gray-500 text-xs text-center">
            The term &ldquo;Etsy&rdquo; is a trademark of Etsy, Inc. This application uses the Etsy API but is not endorsed or certified by Etsy, Inc.
          </p>
          <div className="flex flex-col md:flex-row items-center justify-between gap-2">
            <p className="text-gray-600 text-xs">&copy; {year} {brandName}. All rights reserved.</p>
            <p className="text-gray-700 text-xs">{brandName} is independently developed and not affiliated with Etsy, Inc.</p>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default Footer;