import React from 'react';
import { Card, Empty } from 'antd';

let Pie;
try {
  Pie = require('@ant-design/charts').Pie;
} catch {
  Pie = null;
}

const PLAN_COLORS_MAP = {
  Free: '#8c8c8c',
  Starter: '#3B82F6',
  Pro: '#7C3AED',
  Unlimited: '#F59E0B',
};

const DistributionChart = ({ data = [], loading = false }) => {
  if (!Pie) {
    return (
      <Card title="Subscription Distribution" loading={loading}>
        <Empty description="Charts unavailable" />
      </Card>
    );
  }

  const chartData = data.map((item) => ({
    plan: item.plan || item._id,
    count: item.count || 0,
  }));

  const config = {
    data: chartData,
    angleField: 'count',
    colorField: 'plan',
    radius: 0.85,
    innerRadius: 0.55,
    height: 300,
    label: {
      text: 'count',
      style: { fontWeight: 'bold' },
    },
    legend: { color: { position: 'bottom', layout: { justifyContent: 'center' } } },
    tooltip: {
      title: 'plan',
    },
  };

  return (
    <Card title="Subscription Distribution" loading={loading}>
      {chartData.length > 0 ? <Pie {...config} /> : <Empty description="No data available" />}
    </Card>
  );
};

export default DistributionChart;
