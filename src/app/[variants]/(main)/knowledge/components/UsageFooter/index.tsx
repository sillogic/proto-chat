'use client';

import { Progress } from 'antd';
import { createStyles } from 'antd-style';
import { memo } from 'react';
import { Flexbox } from 'react-layout-kit';

import { useClientDataSWR } from '@/libs/swr';
import { usageService } from '@/services/usage';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    margin-block-start: auto;
    padding-block: 12px;
    padding-inline: 4px;
    border-block-start: 1px solid ${token.colorBorderSecondary};
  `,
  label: css`
    font-size: 12px;
    color: ${token.colorTextDescription};
  `,
  value: css`
    font-size: 12px;
    font-weight: 500;
    font-variant-numeric: tabular-nums;
    color: ${token.colorText};
  `,
}));

/**
 * Format bytes to human readable format
 */
const formatBytes = (bytes: number, decimals = 1): string => {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(decimals))} ${sizes[i]}`;
};

const UsageFooter = memo(() => {
  const { styles } = useStyles();

  const { data: stats, isLoading } = useClientDataSWR('getAccountStatistics', () =>
    usageService.getAccountStatistics(),
  );

  if (isLoading || !stats) return null;

  const { storage, vectors } = stats;

  // Calculate storage usage
  const storageTotalBytes = storage.totalSizeMB * 1024 * 1024;
  const storageLimitBytes = storage.limitMB * 1024 * 1024;
  const storagePercent =
    storage.limitMB > 0 ? Math.min(100, (storage.totalSizeMB / storage.limitMB) * 100) : 0;

  // Calculate vector usage
  const vectorPercent = vectors.limit > 0 ? Math.min(100, (vectors.count / vectors.limit) * 100) : 0;

  return (
    <Flexbox className={styles.container} gap={12}>
      {/* File Storage Usage */}
      <Flexbox gap={6}>
        <Flexbox align={'center'} horizontal justify={'space-between'}>
          <div className={styles.label}>文件用量</div>
          <div className={styles.value}>
            {formatBytes(storageTotalBytes)} / {formatBytes(storageLimitBytes)}
          </div>
        </Flexbox>
        <Progress
          percent={storagePercent}
          showInfo={false}
          size={['100%', 4]}
          strokeColor={{ '0%': '#1890ff', '100%': '#36cfc9' }}
        />
      </Flexbox>

      {/* Vector Storage Usage */}
      <Flexbox gap={6}>
        <Flexbox align={'center'} horizontal justify={'space-between'}>
          <div className={styles.label}>向量存储</div>
          <div className={styles.value}>
            {vectors.count} / {vectors.limit}
          </div>
        </Flexbox>
        <Progress
          percent={vectorPercent}
          showInfo={false}
          size={['100%', 4]}
          strokeColor={{ '0%': '#52c41a', '100%': '#73d13d' }}
        />
      </Flexbox>
    </Flexbox>
  );
});

UsageFooter.displayName = 'UsageFooter';

export default UsageFooter;
