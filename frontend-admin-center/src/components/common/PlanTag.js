import React from 'react';
import { Tag } from 'antd';
import { PLAN_COLORS } from '../../utils/constants';
import { capitalize } from '../../utils/helpers';

const PlanTag = ({ plan }) => {
  return (
    <Tag color={PLAN_COLORS[plan] || 'default'}>
      {capitalize(plan)}
    </Tag>
  );
};

export default PlanTag;
