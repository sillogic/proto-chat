'use client';

import { Icon } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { MessageSquareHeart } from 'lucide-react';
import Link from 'next/link';
import { PropsWithChildren, memo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import FeedbackModal from '@/components/FeedbackModal';
import GuideModal from '@/components/GuideModal';
import GuideVideo from '@/components/GuideVideo';
import { GITHUB } from '@/const/url';
import { featureFlagsSelectors, useServerConfigStore } from '@/store/serverConfig';
import { isOnServerSide } from '@/utils/env';

const useStyles = createStyles(
  ({ css, token }) => css`
    font-size: 12px;
    color: ${token.colorTextSecondary};
  `,
);

export const LayoutSettingsFooterClassName = 'settings-layout-footer';

const Footer = memo<PropsWithChildren>(() => {
  const { t } = useTranslation('common');
  const [openStar, setOpenStar] = useState(false);
  const [openFeedback, setOpenFeedback] = useState(false);
  const { styles } = useStyles();

  const { hideGitHub } = useServerConfigStore(featureFlagsSelectors);

  return hideGitHub ? null : (
    <>
      <Flexbox className={LayoutSettingsFooterClassName} justify={'flex-end'}>
        <Center
          as={'footer'}
          className={styles}
          flex={'none'}
          horizontal
          padding={16}
          width={'100%'}
        >
          <div style={{ textAlign: 'center' }}>
            <Icon icon={MessageSquareHeart} /> {`${t('footer.title')} `}
            <Link
              aria-label={'star'}
              href={GITHUB}
              onClick={(e) => {
                e.preventDefault();
                setOpenStar(true);
              }}
            >
              {t('footer.action.star')}
            </Link>
            {` ${t('footer.and')} `}
            <Link
              aria-label={'feedback'}
              href="#"
              onClick={(e) => {
                e.preventDefault();
                setOpenFeedback(true);
              }}
            >
              {t('footer.action.feedback')}
            </Link>
            {' !'}
          </div>
        </Center>
      </Flexbox>
      <GuideModal
        cancelText={t('footer.later')}
        cover={<GuideVideo height={269} src={'/videos/star.mp4?v=1'} width={358} />}
        desc={t('footer.star.desc')}
        okText={t('footer.star.action')}
        onCancel={() => setOpenStar(false)}
        onOk={() => {
          if (isOnServerSide) return;
          window.open(GITHUB, '__blank');
        }}
        open={openStar}
        title={t('footer.star.title')}
      />
      <FeedbackModal onClose={() => setOpenFeedback(false)} open={openFeedback} />
    </>
  );
});

Footer.displayName = 'SettingFooter';

export default Footer;
