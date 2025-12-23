import { IDocument } from '@cyntler/react-doc-viewer';
import { Button } from '@lobehub/ui';
import { createStyles, keyframes } from 'antd-style';
import { FileQuestion } from 'lucide-react';
import Link from 'next/link';
import React, { ComponentType, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Center, Flexbox } from 'react-layout-kit';

import { MORE_FILE_PREVIEW_REQUEST_URL } from '@/const/url';
import { downloadFile } from '@/utils/client/downloadFile';

const float = keyframes`
  0%, 100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-4px);
  }
`;

const useStyles = createStyles(({ css, token }) => ({
  fileIcon: css`
    color: ${token.colorTextSecondary};
    animation: ${float} 2s ease-in-out infinite;
  `,
  page: css`
    width: 100%;
    margin: 12px;
    padding: 24px;
    border-radius: 4px;

    background: ${token.colorBgContainer};
    box-shadow: ${token.boxShadowTertiary};
  `,
}));

const NotSupport: ComponentType<{
  document: IDocument | undefined;
  fileName: string;
}> = ({ fileName, document: doc }) => {
  const { styles } = useStyles();

  const { t } = useTranslation('file');

  const [loading, setLoading] = useState(false);

  return (
    <Flexbox className={styles.page} id="txt-renderer">
      <Center height={'100%'}>
        <Flexbox align={'center'} gap={12}>
          <FileQuestion className={styles.fileIcon} size={64} strokeWidth={1.5} />
          <Flexbox style={{ textAlign: 'center' }}>
            <Trans i18nKey="preview.unsupportedFileAndContact" ns={'file'}>
              此文件格式暂不支持在线预览，如有预览诉求，欢迎
              <Link aria-label={'todo'} href={MORE_FILE_PREVIEW_REQUEST_URL} target="_blank">
                反馈给我们
              </Link>
            </Trans>
          </Flexbox>
          <Button
            loading={loading}
            onClick={async () => {
              if (!doc) return;
              setLoading(true);
              await downloadFile(doc.uri, fileName);
              setLoading(false);
            }}
          >
            {t('preview.downloadFile')}
          </Button>
        </Flexbox>
      </Center>
    </Flexbox>
  );
};

export default NotSupport;
