/**
 * Design System Tokens
 * Centralized color palette, spacing, radii, and shadows
 * for the Sellsera Customer Center.
 */

export const colors = {
  brand:      '#6C63FF',
  brandLight: '#4facfe',
  brandBg:    'rgba(108,99,255,0.08)',
  brandBgDark:'rgba(108,99,255,0.15)',

  success:    '#10B981',
  warning:    '#F59E0B',
  danger:     '#EF4444',
  info:       '#3B82F6',
  muted:      '#64748B',

  darkBg:     '#0D1117',
  darkCard:   '#1a1a2e',
  darkBorder: '#2e2e4a',

  lightBg:    '#f5f5fa',
  lightCard:  '#ffffff',
  lightBorder:'#f0f0f5',
};

export const radii = {
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  pill: 999,
};

export const shadows = {
  sm:   '0 1px 3px rgba(0,0,0,0.08)',
  md:   '0 4px 12px rgba(108,99,255,0.08)',
  lg:   '0 8px 24px rgba(108,99,255,0.12)',
  none: 'none',
};

/**
 * Usage thresholds for color coding
 * < 60% = green, 60-90% = amber, > 90% = red
 */
export const usageColor = (used, limit) => {
  if (!limit || limit < 0) return colors.success; // unlimited
  const pct = (used / limit) * 100;
  if (pct >= 90) return colors.danger;
  if (pct >= 60) return colors.warning;
  return colors.success;
};

export default { colors, radii, shadows, usageColor };
