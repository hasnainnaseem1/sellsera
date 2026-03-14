import React from 'react';
import { Tag, Tooltip } from 'antd';
import { usageColor } from '../../theme/tokens';

/**
 * UsageBadge — compact pill showing feature usage like "3/10"
 *
 * Props:
 *   used      — current usage count
 *   limit     — max allowed (null/-1 = unlimited)
 *   showLabel — if true, shows text beside the badge
 */
const UsageBadge = ({ used = 0, limit, showLabel = false }) => {
  const unlimited = limit === null || limit === undefined || limit === -1;
  const color = usageColor(used, limit);

  const label = unlimited ? '∞' : `${used}/${limit}`;
  const pct = unlimited ? 0 : Math.round((used / (limit || 1)) * 100);
  const tooltip = unlimited
    ? 'Unlimited usage'
    : `${used} of ${limit} used (${pct}%)`;

  return (
    <Tooltip title={tooltip}>
      <Tag
        color={color}
        style={{
          fontSize: 11,
          fontWeight: 700,
          padding: '0 8px',
          lineHeight: '20px',
          borderRadius: 10,
          margin: 0,
          border: 'none',
          cursor: 'default',
        }}
      >
        {label}{showLabel && !unlimited ? ` used` : ''}
      </Tag>
    </Tooltip>
  );
};

export default UsageBadge;
