import React from 'react';
import { Card, Empty } from 'antd';

let Line;
try {
  Line = require('@ant-design/charts').Line;
} catch {
  Line = null;
}

const GrowthChart = ({ data = [], loading = false }) => {
  if (!Line) {
    return (
      <Card title="User Growth" loading={loading}>
        <Empty description="Charts unavailable" />
      </Card>
    );
  }

  const chartData = data.flatMap((item) => [
    { date: item.date, value: item.newUsers || 0, type: 'New Users' },
    { date: item.date, value: item.newCustomers || 0, type: 'New Customers' },
  ]);

  const config = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    smooth: true,
    height: 300,
    point: { shapeField: 'square', sizeField: 3 },
    interaction: { tooltip: { marker: true } },
    style: { lineWidth: 2 },
  };

  return (
    <Card title="User Growth" loading={loading}>
      {chartData.length > 0 ? <Line {...config} /> : <Empty description="No data available" />}
    </Card>
  );
};

export default GrowthChart;
