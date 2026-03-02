import React from 'react';
import { Card, Empty } from 'antd';

let Line;
try {
  Line = require('@ant-design/charts').Line;
} catch {
  Line = null;
}

const TrendChart = ({ data = [], loading = false }) => {
  if (!Line) {
    return (
      <Card title="Analysis Trends" loading={loading}>
        <Empty description="Charts unavailable" />
      </Card>
    );
  }

  const chartData = data.flatMap((item) => [
    { date: item.date, value: item.totalAnalyses || 0, type: 'Total' },
    { date: item.date, value: item.completed || 0, type: 'Completed' },
  ]);

  const config = {
    data: chartData,
    xField: 'date',
    yField: 'value',
    colorField: 'type',
    smooth: true,
    height: 300,
    interaction: { tooltip: { marker: true } },
    style: { lineWidth: 2 },
  };

  return (
    <Card title="Analysis Trends" loading={loading}>
      {chartData.length > 0 ? <Line {...config} /> : <Empty description="No data available" />}
    </Card>
  );
};

export default TrendChart;
