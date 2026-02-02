import React from 'react';
import { Card, Row, Col } from 'antd';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import type { EnhancedDashboardData } from '@/services/api.d';

interface TrendsChartProps {
  data: EnhancedDashboardData['period'];
  loading?: boolean;
}

// 收入趋势图表
const RevenueTrendChart: React.FC<{ data: EnhancedDashboardData['period']['revenueTrend'] }> = ({ data }) => {
  const option: EChartsOption = {
    title: {
      text: '收入趋势',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'normal',
      },
    },
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        if (!Array.isArray(params) || params.length === 0) return '';
        const param = params[0];
        return `${param.axisValue}<br/>收入: ¥${param.value.toFixed(2)}`;
      },
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '3%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      boundaryGap: false,
      axisLabel: {
        formatter: (value: string) => {
          // 格式化日期显示 MM-DD
          const date = new Date(value);
          return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '收入 (¥)',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 1000) {
            return `¥${(value / 1000).toFixed(1)}k`;
          }
          return `¥${value}`;
        },
      },
    },
    series: [
      {
        name: '收入',
        type: 'line',
        smooth: true,
        data: data.map((item) => item.revenue),
        itemStyle: {
          color: '#cf1322',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(207, 19, 34, 0.3)' },
              { offset: 1, color: 'rgba(207, 19, 34, 0.05)' },
            ],
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

// 用户增长趋势图表
const UserGrowthTrendChart: React.FC<{ data: EnhancedDashboardData['period']['userGrowthTrend'] }> = ({ data }) => {
  const option: EChartsOption = {
    title: {
      text: '用户增长',
      left: 'center',
      textStyle: {
        fontSize: 16,
        fontWeight: 'normal',
      },
    },
    tooltip: {
      trigger: 'axis',
    },
    legend: {
      data: ['新增用户', '活跃用户'],
      bottom: 0,
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      containLabel: true,
    },
    xAxis: {
      type: 'category',
      data: data.map((item) => item.date),
      boundaryGap: false,
      axisLabel: {
        formatter: (value: string) => {
          // 格式化日期显示 MM-DD
          const date = new Date(value);
          return `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
        },
      },
    },
    yAxis: {
      type: 'value',
      name: '用户数',
      axisLabel: {
        formatter: (value: number) => {
          if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}k`;
          }
          return value.toString();
        },
      },
    },
    series: [
      {
        name: '新增用户',
        type: 'line',
        smooth: true,
        data: data.map((item) => item.newUsers),
        itemStyle: {
          color: '#1890ff',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
              { offset: 1, color: 'rgba(24, 144, 255, 0.05)' },
            ],
          },
        },
      },
      {
        name: '活跃用户',
        type: 'line',
        smooth: true,
        data: data.map((item) => item.activeUsers),
        itemStyle: {
          color: '#52c41a',
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(82, 196, 26, 0.3)' },
              { offset: 1, color: 'rgba(82, 196, 26, 0.05)' },
            ],
          },
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: '300px' }} />;
};

// 趋势图表主组件
const TrendsChart: React.FC<TrendsChartProps> = ({ data, loading }) => {
  return (
    <Row gutter={[16, 16]}>
      <Col xs={24} lg={12}>
        <Card loading={loading} bodyStyle={{ padding: '16px' }}>
          <RevenueTrendChart data={data.revenueTrend} />
        </Card>
      </Col>
      <Col xs={24} lg={12}>
        <Card loading={loading} bodyStyle={{ padding: '16px' }}>
          <UserGrowthTrendChart data={data.userGrowthTrend} />
        </Card>
      </Col>
    </Row>
  );
};

export default TrendsChart;
