'use client';

import { Flexbox } from '@lobehub/ui';
import { FileText, ImageIcon, LayoutPanelTopIcon } from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';

import NavItem from '@/features/NavPanel/components/NavItem';
import { FilesTabs } from '@/types/files';

import { useResourceManagerStore } from '../../../features/store';

const CategoryMenu = memo(() => {
  const { t } = useTranslation('file');
  const [activeKey, setMode] = useResourceManagerStore((s) => [s.category, s.setMode]);
  const navigate = useNavigate();

  const items = useMemo(
    () => [
      {
        icon: LayoutPanelTopIcon,
        key: FilesTabs.All,
        title: t('tab.all'),
        url: '/resource',
      },
      {
        icon: FileText,
        key: FilesTabs.Documents,
        title: t('tab.documents'),
        url: '/resource?category=documents',
      },
      {
        icon: ImageIcon,
        key: FilesTabs.Images,
        title: t('tab.images'),
        url: '/resource?category=images',
      },
    ],
    [t],
  );

  return (
    <Flexbox gap={1} paddingInline={4}>
      {items.map((item) => (
        <Link
          key={item.key}
          to={item.url}
          onClick={(e) => {
            e.preventDefault();
            setMode('explorer');
            navigate(item.url, { replace: true });
          }}
        >
          <NavItem active={activeKey === item.key} icon={item.icon} title={item.title} />
        </Link>
      ))}
    </Flexbox>
  );
});

CategoryMenu.displayName = 'CategoryMenu';

export default CategoryMenu;
