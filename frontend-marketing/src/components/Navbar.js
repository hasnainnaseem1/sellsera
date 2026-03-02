import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X, Zap } from 'lucide-react';
import { useSite } from '../context/SiteContext';
import config from '../config';

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { site, navigation, loading } = useSite();

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  const brandName = site.companyName || site.siteName || '';

  if (loading) {
    return (
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16" />
        </div>
      </nav>
    );
  }

  return (
    <nav className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-2">
            {site.logoUrl ? (
              <img src={site.logoUrl} alt={brandName} className="h-8 w-auto" />
            ) : (
              <Zap className="w-8 h-8 text-purple-600" />
            )}
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
              {brandName}
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            {navigation.map((item) => (
              <Link
                key={item.slug}
                to={item.path}
                className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
              >
                {item.label}
              </Link>
            ))}
            {site.enableLogin !== false && (
              <a
                href={`${config.customerCenterUrl}/login`}
                className="text-gray-700 hover:text-purple-600 font-medium transition-colors"
              >
                Login
              </a>
            )}
            {site.enableCustomerSignup && (
              <a
                href={`${config.customerCenterUrl}/signup`}
                className="bg-gradient-to-r from-purple-600 to-blue-500 text-white px-6 py-2 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-600 transition-all transform hover:scale-105"
              >
                Get Started Free
              </a>
            )}
          </div>

          {/* Mobile menu button */}
          <button
            onClick={toggleMenu}
            className="md:hidden p-2 rounded-lg hover:bg-gray-100 transition-colors"
          >
            {isMenuOpen ? (
              <X className="w-6 h-6 text-gray-700" />
            ) : (
              <Menu className="w-6 h-6 text-gray-700" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isMenuOpen && (
        <div className="md:hidden bg-white border-t border-gray-200">
          <div className="px-4 py-4 space-y-3">
            {navigation.map((item) => (
              <Link
                key={item.slug}
                to={item.path}
                className="block text-gray-700 hover:text-purple-600 font-medium py-2 transition-colors"
                onClick={toggleMenu}
              >
                {item.label}
              </Link>
            ))}
            {site.enableLogin !== false && (
              <a href={`${config.customerCenterUrl}/login`}
                className="block text-gray-700 hover:text-purple-600 font-medium py-2 transition-colors"
                onClick={toggleMenu}>
                Login
              </a>
            )}
            {site.enableCustomerSignup && (
              <a href={`${config.customerCenterUrl}/signup`}
                className="block w-full text-center bg-gradient-to-r from-purple-600 to-blue-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-purple-700 hover:to-blue-600 transition-all"
                onClick={toggleMenu}>
                Get Started Free
              </a>
            )}
          </div>
        </div>
      )}
    </nav>
  );
};

export default Navbar;