/**
 * Etsy Supported Countries
 *
 * Maps ISO 3166-1 alpha-2 codes to Etsy shop_location strings.
 * The Etsy findAllListingsActive API `shop_location` parameter expects
 * a location string (country name), NOT an ISO code.
 *
 * This list covers all countries where Etsy has seller presence.
 */

const ETSY_COUNTRIES = [
  { code: 'US', name: 'United States', flag: '🇺🇸', shopLocation: 'United States' },
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧', shopLocation: 'United Kingdom' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦', shopLocation: 'Canada' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺', shopLocation: 'Australia' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪', shopLocation: 'Germany' },
  { code: 'FR', name: 'France', flag: '🇫🇷', shopLocation: 'France' },
  { code: 'IN', name: 'India', flag: '🇮🇳', shopLocation: 'India' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹', shopLocation: 'Italy' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸', shopLocation: 'Spain' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱', shopLocation: 'Netherlands' },
  { code: 'PL', name: 'Poland', flag: '🇵🇱', shopLocation: 'Poland' },
  { code: 'UA', name: 'Ukraine', flag: '🇺🇦', shopLocation: 'Ukraine' },
  { code: 'TR', name: 'Turkey', flag: '🇹🇷', shopLocation: 'Turkey' },
  { code: 'IL', name: 'Israel', flag: '🇮🇱', shopLocation: 'Israel' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵', shopLocation: 'Japan' },
  { code: 'KR', name: 'South Korea', flag: '🇰🇷', shopLocation: 'South Korea' },
  { code: 'RU', name: 'Russia', flag: '🇷🇺', shopLocation: 'Russia' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷', shopLocation: 'Brazil' },
  { code: 'MX', name: 'Mexico', flag: '🇲🇽', shopLocation: 'Mexico' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭', shopLocation: 'Thailand' },
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩', shopLocation: 'Indonesia' },
  { code: 'PH', name: 'Philippines', flag: '🇵🇭', shopLocation: 'Philippines' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳', shopLocation: 'Vietnam' },
  { code: 'GR', name: 'Greece', flag: '🇬🇷', shopLocation: 'Greece' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹', shopLocation: 'Portugal' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪', shopLocation: 'Sweden' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴', shopLocation: 'Norway' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰', shopLocation: 'Denmark' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮', shopLocation: 'Finland' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪', shopLocation: 'Belgium' },
  { code: 'AT', name: 'Austria', flag: '🇦🇹', shopLocation: 'Austria' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭', shopLocation: 'Switzerland' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪', shopLocation: 'Ireland' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿', shopLocation: 'New Zealand' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦', shopLocation: 'South Africa' },
  { code: 'SG', name: 'Singapore', flag: '🇸🇬', shopLocation: 'Singapore' },
  { code: 'HK', name: 'Hong Kong', flag: '🇭🇰', shopLocation: 'Hong Kong' },
  { code: 'TW', name: 'Taiwan', flag: '🇹🇼', shopLocation: 'Taiwan' },
  { code: 'RO', name: 'Romania', flag: '🇷🇴', shopLocation: 'Romania' },
  { code: 'CZ', name: 'Czech Republic', flag: '🇨🇿', shopLocation: 'Czech Republic' },
  { code: 'HU', name: 'Hungary', flag: '🇭🇺', shopLocation: 'Hungary' },
  { code: 'BG', name: 'Bulgaria', flag: '🇧🇬', shopLocation: 'Bulgaria' },
  { code: 'HR', name: 'Croatia', flag: '🇭🇷', shopLocation: 'Croatia' },
  { code: 'LT', name: 'Lithuania', flag: '🇱🇹', shopLocation: 'Lithuania' },
  { code: 'LV', name: 'Latvia', flag: '🇱🇻', shopLocation: 'Latvia' },
  { code: 'EE', name: 'Estonia', flag: '🇪🇪', shopLocation: 'Estonia' },
  { code: 'SK', name: 'Slovakia', flag: '🇸🇰', shopLocation: 'Slovakia' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾', shopLocation: 'Malaysia' },
  { code: 'CL', name: 'Chile', flag: '🇨🇱', shopLocation: 'Chile' },
  { code: 'CO', name: 'Colombia', flag: '🇨🇴', shopLocation: 'Colombia' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷', shopLocation: 'Argentina' },
  { code: 'PK', name: 'Pakistan', flag: '🇵🇰', shopLocation: 'Pakistan' },
  { code: 'NG', name: 'Nigeria', flag: '🇳🇬', shopLocation: 'Nigeria' },
  { code: 'KE', name: 'Kenya', flag: '🇰🇪', shopLocation: 'Kenya' },
  { code: 'EG', name: 'Egypt', flag: '🇪🇬', shopLocation: 'Egypt' },
  { code: 'MA', name: 'Morocco', flag: '🇲🇦', shopLocation: 'Morocco' },
];

// Quick lookup: ISO code → shop_location string
const CODE_TO_LOCATION = {};
for (const c of ETSY_COUNTRIES) {
  CODE_TO_LOCATION[c.code] = c.shopLocation;
}

module.exports = { ETSY_COUNTRIES, CODE_TO_LOCATION };
