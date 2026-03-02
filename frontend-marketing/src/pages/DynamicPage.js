import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BlockRenderer from '../components/BlockRenderer';
import { useSite } from '../context/SiteContext';
import { updatePageSeo, setBreadcrumbSchema, clearPageSchemas } from '../utils/seoHelpers';
import config from '../config';

const DynamicPage = ({ isHome = false }) => {
  const { slug } = useParams();
  const { site, seo } = useSite();
  const [page, setPage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchPage = async () => {
      setLoading(true);
      setError(false);
      clearPageSchemas();
      try {
        let url;
        if (isHome) {
          url = `${config.apiUrl}/api/v1/public/marketing/home`;
        } else {
          url = `${config.apiUrl}/api/v1/public/marketing/pages/${slug}`;
        }
        const res = await fetch(url);
        const data = await res.json();

        if (data.success && data.page) {
          setPage(data.page);

          const pageTitle = data.page.metaTitle || data.page.title;
          const pageDesc = data.page.metaDescription || data.page.description || '';
          const pageUrl = isHome ? window.location.origin : `${window.location.origin}/${data.page.slug}`;
          const ogImage = data.page.ogImage || seo.defaultOgImage || '';

          // Inject full SEO meta tags
          updatePageSeo({
            title: isHome ? (site.siteName || pageTitle) : pageTitle,
            description: pageDesc,
            keywords: data.page.metaKeywords || '',
            ogImage,
            ogType: 'website',
            canonicalUrl: data.page.canonicalUrl || pageUrl,
            noIndex: data.page.noIndex || false,
            siteName: site.siteName || '',
            url: pageUrl,
            twitterHandle: seo.socialLinks?.twitter || '',
          });

          // Breadcrumb schema
          if (!isHome) {
            setBreadcrumbSchema([
              { name: 'Home', url: window.location.origin },
              { name: data.page.title, url: pageUrl },
            ]);
          }
        } else {
          setError(true);
        }
      } catch (err) {
        console.error('Failed to fetch page:', err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    fetchPage();
  }, [slug, isHome, site.siteName]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="flex items-center justify-center py-40">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
        </div>
        <Footer />
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-40 text-center">
          <h1 className="text-6xl font-bold text-gray-300 mb-4">404</h1>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Page Not Found</h2>
          <p className="text-gray-600 mb-8">The page you're looking for doesn't exist or has been removed.</p>
          <a href="/" className="bg-purple-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-purple-700 transition-all">
            Go Home
          </a>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main>
        <BlockRenderer blocks={page.blocks || []} />
      </main>
      {page.customCSS && <style>{page.customCSS}</style>}
      <Footer />
    </div>
  );
};

export default DynamicPage;
