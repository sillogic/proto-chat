'use client';

import { type ActionIconGroupProps, type ActionIconProps } from '@lobehub/ui';
import { ActionIconGroup } from '@lobehub/ui';
import { Dices, Download, Pencil, Trash2 } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { styles } from './styles';
import { type ActionButtonsProps } from './types';

const actionIconProps: Partial<Omit<ActionIconProps, 'size' | 'ref' | 'icon'>> = {
  tooltipProps: { placement: 'left' },
};
// Action buttons component
export const ActionButtons = memo<ActionButtonsProps>(
  ({
    onDelete,
    onDownload,
    onCopySeed,
    onUseAsReference,
    showDownload = false,
    showCopySeed = false,
    showUseAsReference = false,
    seedTooltip,
  }) => {
    const { t } = useTranslation('image');

    return (
      <ActionIconGroup
        actionIconProps={actionIconProps}
        className={styles.generationActionButton}
        horizontal={false}
        variant="outlined"
        items={useMemo(
          () =>
            [
              Boolean(showDownload && onDownload) && {
                icon: Download,
                key: 'download',
                label: t('generation.actions.download'),
                onClick: onDownload,
              },
              Boolean(showCopySeed && onCopySeed) && {
                icon: Dices,
                key: 'copySeed',
                label: seedTooltip,
                onClick: onCopySeed,
              },
              Boolean(showUseAsReference && onUseAsReference) && {
                icon: Pencil,
                key: 'useAsReference',
                label: t('generation.actions.useAsReference'),
                onClick: onUseAsReference,
              },
              {
                danger: true,
                icon: Trash2,
                key: 'delete',
                label: t('generation.actions.delete'),
                onClick: onDelete,
              },
            ].filter(Boolean) as ActionIconGroupProps['items'],
          [showDownload, onDownload, showCopySeed, onCopySeed, seedTooltip, showUseAsReference, onUseAsReference, onDelete],
        )}
      />
    );
  },
);

ActionButtons.displayName = 'ActionButtons';
