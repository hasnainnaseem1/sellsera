import React, { createContext, useContext, useState, useEffect } from 'react';
import config from '../config';
import {
  setOrganizationSchema,
  setWebSiteSchema,
  initGoogleAnalytics,
  setVerificationTags,
  injectCustomHeadScripts,
} from '../utils/seoHelpers';

const SiteContext = createContext({});

export const useSite = () => useContext(SiteContext);

// Helper: convert hex color to comma-separated RGB for use in rgba()
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
    : '124, 58, 237';
};

export const SiteProvider = ({ children }) => {
  const [site, setSite] = useState({
    siteName: '',
    siteDescription: '',
    contactEmail: '',
    supportEmail: '',
    primaryColor: '#7c3aed',
    secondaryColor: '#3b82f6',
    accentColor: '#f59e0b',
    logoUrl: '',
    faviconUrl: '',
    companyName: '',
    appTagline: '',
    appDescription: '',
    enableCustomerSignup: true,
    enableLogin: true,
    maintenance: { enabled: false, message: '' },
  });
  const [navigation, setNavigation] = useState([]);
  const [pages, setPages] = useState([]);
  const [seo, setSeo] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSiteData = async () => {
      try {
        const [siteRes, navRes, pagesRes, seoRes] = await Promise.all([
          fetch(`${config.apiUrl}/api/v1/public/marketing/site`).then(r => r.json()),
          fetch(`${config.apiUrl}/api/v1/public/marketing/navigation`).then(r => r.json()),
          fetch(`${config.apiUrl}/api/v1/public/marketing/pages`).then(r => r.json()),
          fetch(`${config.apiUrl}/api/v1/public/seo/settings`).then(r => r.json()),
        ]);

        if (siteRes.success) setSite(siteRes.site);
        if (navRes.success) setNavigation(navRes.navigation);
        if (pagesRes.success) setPages(pagesRes.pages);
        if (seoRes.success) setSeo(seoRes.seo || {});

        // Update favicon dynamically
        if (siteRes.site?.faviconUrl) {
          // Update all existing favicon/icon links
          const iconLinks = document.querySelectorAll("link[rel*='icon']");
          iconLinks.forEach(link => {
            link.href = siteRes.site.faviconUrl;
          });
          // Also ensure a standard shortcut icon exists
          if (!document.querySelector("link[rel='shortcut icon']")) {
            const newLink = document.createElement('link');
            newLink.rel = 'shortcut icon';
            newLink.href = siteRes.site.faviconUrl;
            document.head.appendChild(newLink);
          }
        }

        // Update page title & meta description
        if (siteRes.site?.siteName) {
          document.title = siteRes.site.siteName;
        }
        if (siteRes.site?.siteDescription) {
          let meta = document.querySelector('meta[name="description"]');
          if (meta) meta.content = siteRes.site.siteDescription;
        }
        // Update theme-color meta
        if (siteRes.site?.primaryColor) {
          let tc = document.querySelector('meta[name="theme-color"]');
          if (tc) tc.content = siteRes.site.primaryColor;
        }

        // === Global SEO Injection ===
        const seoData = seoRes?.seo || {};
        const siteUrl = window.location.origin;

        // Google Analytics
        if (seoData.googleAnalyticsId) {
          initGoogleAnalytics(seoData.googleAnalyticsId);
        }

        // Verification tags
        setVerificationTags({
          google: seoData.googleSearchConsoleVerification,
          bing: seoData.bingVerification,
        });

        // Organization schema
        if (seoData.enableSchemaMarkup !== false) {
          setOrganizationSchema({
            name: siteRes.site?.companyName || siteRes.site?.siteName || '',
            url: siteUrl,
            logo: siteRes.site?.logoUrl || '',
            description: siteRes.site?.siteDescription || '',
            socialLinks: seoData.socialLinks || {},
          });
          setWebSiteSchema({
            name: siteRes.site?.siteName || '',
            url: siteUrl,
          });
        }

        // Custom head scripts (e.g., Facebook Pixel, Hotjar, etc.)
        if (seoData.customHeadScripts) {
          injectCustomHeadScripts(seoData.customHeadScripts);
        }
      } catch (err) {
        console.error('Failed to fetch site data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSiteData();
  }, []);

  // ─── Inject dynamic brand colors as CSS custom properties + overrides ───
  useEffect(() => {
    const pc = site.primaryColor || '#7c3aed';
    const sc = site.secondaryColor || '#3b82f6';
    const ac = site.accentColor || '#f59e0b';
    const pcRgb = hexToRgb(pc);
    const scRgb = hexToRgb(sc);
    const acRgb = hexToRgb(ac);

    // Set CSS custom properties on :root
    const root = document.documentElement;
    root.style.setProperty('--color-primary', pc);
    root.style.setProperty('--color-secondary', sc);
    root.style.setProperty('--color-accent', ac);
    root.style.setProperty('--color-primary-rgb', pcRgb);
    root.style.setProperty('--color-secondary-rgb', scRgb);
    root.style.setProperty('--color-accent-rgb', acRgb);

    // Inject / update dynamic stylesheet that overrides Tailwind purple/blue classes
    let styleEl = document.getElementById('dynamic-brand-colors');
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = 'dynamic-brand-colors';
      document.head.appendChild(styleEl);
    }

    styleEl.textContent = `
      /* ═══ Dynamic Brand Color Overrides ═══ */

      /* ── Text colors ── */
      .text-purple-600, .text-purple-500 { color: var(--color-primary) !important; }
      .text-purple-400 { color: var(--color-primary) !important; }
      .text-purple-200 { color: rgba(255,255,255,0.7) !important; }
      .text-purple-100 { color: rgba(255,255,255,0.85) !important; }
      .text-purple-900 { color: var(--color-primary) !important; }

      /* ── Background colors ── */
      .bg-purple-600, .bg-purple-500 { background-color: var(--color-primary) !important; }
      .bg-purple-400 { background-color: rgba(var(--color-primary-rgb), 0.75) !important; }
      .bg-purple-200 { background-color: rgba(var(--color-primary-rgb), 0.2) !important; }
      .bg-purple-100 { background-color: rgba(var(--color-primary-rgb), 0.15) !important; }
      .bg-purple-50  { background-color: rgba(var(--color-primary-rgb), 0.05) !important; }

      /* ── Border colors ── */
      .border-purple-600 { border-color: var(--color-primary) !important; }
      .border-purple-300 { border-color: rgba(var(--color-primary-rgb), 0.4) !important; }
      .border-purple-200 { border-color: rgba(var(--color-primary-rgb), 0.25) !important; }

      /* ── Gradient stops (from = primary, to = secondary) ── */
      .from-purple-600 { --tw-gradient-from: var(--color-primary) !important; }
      .from-purple-400 { --tw-gradient-from: rgba(var(--color-primary-rgb), 0.75) !important; }
      .from-purple-50  { --tw-gradient-from: rgba(var(--color-primary-rgb), 0.05) !important; }
      .to-blue-600, .to-blue-500 { --tw-gradient-to: var(--color-secondary) !important; }
      .to-blue-400 { --tw-gradient-to: rgba(var(--color-secondary-rgb), 0.75) !important; }
      .to-blue-50  { --tw-gradient-to: rgba(var(--color-secondary-rgb), 0.05) !important; }

      /* ── Hover states ── */
      .hover\\:text-purple-600:hover,
      .hover\\:text-purple-500:hover { color: var(--color-primary) !important; }
      .hover\\:text-purple-700:hover { color: var(--color-primary) !important; }
      .hover\\:bg-purple-700:hover { background-color: var(--color-primary) !important; filter: brightness(0.9); }
      .hover\\:bg-purple-600:hover { background-color: var(--color-primary) !important; }
      .hover\\:bg-purple-50:hover  { background-color: rgba(var(--color-primary-rgb), 0.05) !important; }
      .hover\\:border-purple-200:hover { border-color: rgba(var(--color-primary-rgb), 0.25) !important; }
      .hover\\:from-purple-700:hover { --tw-gradient-from: var(--color-primary) !important; }
      .hover\\:to-blue-600:hover { --tw-gradient-to: var(--color-secondary) !important; }

      /* ── Focus states ── */
      .focus\\:ring-purple-500:focus { --tw-ring-color: var(--color-primary) !important; }

      /* ── Group hover ── */
      .group:hover .group-hover\\:text-purple-600 { color: var(--color-primary) !important; }

      /* ── Shadow ── */
      .shadow-purple-200 { --tw-shadow-color: rgba(var(--color-primary-rgb), 0.2) !important; }

      /* ── Prose (blog article links) ── */
      .prose a { color: var(--color-primary) !important; }
      .prose a:hover { color: var(--color-primary) !important; filter: brightness(0.85); }

      /* ── Checkbox / radio accent ── */
      input[type="checkbox"].text-purple-600,
      input[type="radio"].text-purple-600 { accent-color: var(--color-primary) !important; }
    `;
  }, [site.primaryColor, site.secondaryColor, site.accentColor]);

  return (
    <SiteContext.Provider value={{ site, navigation, pages, seo, loading }}>
      {children}
    </SiteContext.Provider>
  );
};

export default SiteContext;
