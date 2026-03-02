import React from 'react';
import { Row, Col, Card, Statistic } from 'antd';
import { useNavigate } from 'react-router-dom';
import {
  TeamOutlined,
  UserOutlined,
  ExperimentOutlined,
  DollarOutlined,
  RiseOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
} from '@ant-design/icons';
import { formatNumber, formatCurrency } from '../../utils/helpers';

const StatsCards = ({ overview, userRole }) => {
  const navigate = useNavigate();
  
  if (!overview) return null;

  const cards = [
    {
      title: 'Total Users',
      value: overview.users?.total || 0,
      icon: <TeamOutlined />,
      color: '#7C3AED',
      path: '/users',
      suffix: overview.users?.growth ? (
        <span style={{ fontSize: 14, color: '#52c41a' }}>
          <ArrowUpOutlined /> {overview.users.growth}
        </span>
      ) : null,
    },
    {
      title: 'Active Customers',
      value: overview.customers?.active || 0,
      icon: <UserOutlined />,
      color: '#3B82F6',
      path: '/customers',
    },
    {
      title: 'Total Analyses',
      value: overview.analyses?.total || 0,
      icon: <ExperimentOutlined />,
      color: '#10B981',
      path: '/analytics',
      suffix: overview.analyses?.averageScore ? (
        <span style={{ fontSize: 12, color: '#8c8c8c' }}>
          Avg Score: {overview.analyses.averageScore}
        </span>
      ) : null,
    },
    // Monthly Revenue - only visible to admin and super_admin
    ...(userRole === 'admin' || userRole === 'super_admin' ? [
      {
        title: 'Monthly Revenue',
        value: overview.revenue?.monthly || 0,
        icon: <DollarOutlined />,
        color: '#F59E0B',
        prefix: '$',
        path: '/analytics',
        isRevenue: true,
      }
    ] : []),
  ];

  return (
    <Row gutter={[16, 16]}>
      {cards.map((card) => (
        <Col xs={24} sm={12} lg={6} key={card.title}>
          <Card 
            hoverable 
            styles={{ body: { padding: '20px 24px' } }}
            onClick={() => navigate(card.path)}
            style={{ cursor: 'pointer' }}
          >
            <Statistic
              title={card.title}
              value={card.isRevenue ? card.value : formatNumber(card.value)}
              prefix={
                <span style={{ color: card.color, marginRight: 8 }}>
                  {card.icon}
                </span>
              }
              styles={{ value: { color: card.color } }}
            />
            {card.suffix && <div style={{ marginTop: 4 }}>{card.suffix}</div>}
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default StatsCards;
