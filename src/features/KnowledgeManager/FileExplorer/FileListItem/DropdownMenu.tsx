import { ActionIcon, Dropdown, Icon, copyToClipboard } from '@lobehub/ui';
import { App } from 'antd';
import { ItemType } from 'antd/es/menu/interface';
import {
  BookMinusIcon,
  BookPlusIcon,
  DownloadIcon,
  LinkIcon,
  MoreHorizontalIcon,
  Trash,
} from 'lucide-react';
import { memo, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { useAddFilesToKnowledgeBaseModal } from '@/features/KnowledgeBaseModal';
import { documentService } from '@/services/document';
import { useFileStore } from '@/store/file';
import { useKnowledgeBaseStore } from '@/store/knowledgeBase';
import { downloadFile } from '@/utils/client/downloadFile';

// Custom note file type
const CUSTOM_NOTE_TYPE = 'custom/document';

interface DropdownMenuProps {
  filename: string;
  fileType?: string;
  id: string;
  knowledgeBaseId?: string;
  sourceType?: string;
  url?: string;
}

const DropdownMenu = memo<DropdownMenuProps>(
  ({ id, knowledgeBaseId, url, filename, sourceType, fileType }) => {
    const { t } = useTranslation(['components', 'common']);
    const { message, modal } = App.useApp();

    const [removeFile, removeDocument, refreshFileList] = useFileStore((s) => [
      s.removeFileItem,
      s.removeDocument,
      s.refreshFileList,
    ]);
    const [removeFilesFromKnowledgeBase] = useKnowledgeBaseStore((s) => [
      s.removeFilesFromKnowledgeBase,
    ]);

    const inKnowledgeBase = !!knowledgeBaseId;
    const { open } = useAddFilesToKnowledgeBaseModal();

    // Check if it's a document (note)
    const isNote = sourceType === 'document' || fileType === CUSTOM_NOTE_TYPE;

    const items = useMemo(() => {
      const knowledgeBaseActions = (
        inKnowledgeBase
          ? [
              {
                icon: <Icon icon={BookPlusIcon} />,
                key: 'addToOtherKnowledgeBase',
                label: t('FileManager.actions.addToOtherKnowledgeBase'),
                onClick: async ({ domEvent }) => {
                  domEvent.stopPropagation();

                  open({ fileIds: [id], knowledgeBaseId });
                },
              },
              {
                icon: <Icon icon={BookMinusIcon} />,
                key: 'removeFromKnowledgeBase',
                label: t('FileManager.actions.removeFromKnowledgeBase'),
                onClick: async ({ domEvent }) => {
                  domEvent.stopPropagation();

                  modal.confirm({
                    okButtonProps: {
                      danger: true,
                    },
                    onOk: async () => {
                      await removeFilesFromKnowledgeBase(knowledgeBaseId, [id]);

                      message.success(t('FileManager.actions.removeFromKnowledgeBaseSuccess'));
                    },
                    title: t('FileManager.actions.confirmRemoveFromKnowledgeBase', {
                      count: 1,
                    }),
                  });
                },
              },
            ]
          : [
              {
                icon: <Icon icon={BookPlusIcon} />,
                key: 'addToKnowledgeBase',
                label: t('FileManager.actions.addToKnowledgeBase'),
                onClick: async ({ domEvent }) => {
                  domEvent.stopPropagation();
                  open({ fileIds: [id] });
                },
              },
            ]
      ) as ItemType[];

      // Copy link action - different for notes vs files
      const copyLinkAction = {
        icon: <Icon icon={LinkIcon} />,
        key: 'copyUrl',
        label: t('FileManager.actions.copyUrl'),
        onClick: async ({ domEvent }) => {
          domEvent.stopPropagation();
          if (isNote) {
            // For notes, generate a page link
            const pageUrl = `${window.location.origin}/knowledge/${id}`;
            await copyToClipboard(pageUrl);
          } else {
            await copyToClipboard(url || '');
          }
          message.success(t('FileManager.actions.copyUrlSuccess'));
        },
      };

      // Download action - different for notes vs files
      const downloadAction = {
        icon: <Icon icon={DownloadIcon} />,
        key: 'download',
        label: t('download', { ns: 'common' }),
        onClick: async ({ domEvent }) => {
          domEvent.stopPropagation();
          const key = 'file-downloading';
          message.loading({
            content: t('FileManager.actions.downloading'),
            duration: 0,
            key,
          });

          if (isNote) {
            // For notes, fetch content and download as markdown
            try {
              const doc = await documentService.getDocumentById(id);
              if (doc?.content) {
                const blob = new Blob([doc.content], { type: 'text/markdown' });
                const downloadUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = downloadUrl;
                a.download = `${filename || 'document'}.md`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(downloadUrl);
              }
            } catch (error) {
              console.error('Failed to download document:', error);
              message.error(t('FileManager.actions.downloadError'));
            }
          } else if (url) {
            await downloadFile(url, filename);
          }

          message.destroy(key);
        },
      };

      // Delete action - different for notes vs files
      const deleteAction = {
        danger: true,
        icon: <Icon icon={Trash} />,
        key: 'delete',
        label: t('delete', { ns: 'common' }),
        onClick: async ({ domEvent }) => {
          domEvent.stopPropagation();
          modal.confirm({
            content: t('FileManager.actions.confirmDelete'),
            okButtonProps: { danger: true },
            onOk: async () => {
              if (isNote) {
                await removeDocument(id);
              } else {
                await removeFile(id);
              }
              await refreshFileList();
            },
          });
        },
      };

      return (
        [
          ...knowledgeBaseActions,
          {
            type: 'divider',
          },
          copyLinkAction,
          downloadAction,
          {
            type: 'divider',
          },
          deleteAction,
        ] as ItemType[]
      ).filter(Boolean);
    }, [inKnowledgeBase, isNote, url, id, filename]);
    return (
      <Dropdown menu={{ items }}>
        <ActionIcon icon={MoreHorizontalIcon} size={'small'} />
      </Dropdown>
    );
  },
);

export default DropdownMenu;
