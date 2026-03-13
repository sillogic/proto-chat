'use client';

import { App } from 'antd';
import { memo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

interface UnsavedChangesGuardProps {
  isDirty: boolean;
  message: string;
  onAutoSave?: () => Promise<boolean>;
  title?: string;
}

const UnsavedChangesGuard = memo<UnsavedChangesGuardProps>(
  ({ isDirty, message, onAutoSave, title: _title }) => {
    void _title;
    const { t } = useTranslation('file');
    const { message: messageApi } = App.useApp();

    // Keep refs so the unmount cleanup always sees the latest values
    const isDirtyRef = useRef(isDirty);
    const onAutoSaveRef = useRef(onAutoSave);
    const messageApiRef = useRef(messageApi);
    const tRef = useRef(t);
    isDirtyRef.current = isDirty;
    onAutoSaveRef.current = onAutoSave;
    messageApiRef.current = messageApi;
    tRef.current = t;

    // Auto-save when navigating away within the SPA (component unmounts)
    useEffect(() => {
      return () => {
        if (!isDirtyRef.current || !onAutoSaveRef.current) return;
        const messageKey = `editor-leave-auto-save-${Date.now()}`;
        messageApiRef.current.loading({
          content: tRef.current('pageEditor.saving'),
          duration: 0,
          key: messageKey,
        });
        void onAutoSaveRef.current().then((saved) => {
          if (saved === false) {
            messageApiRef.current.error({
              content: tRef.current('networkError'),
              duration: 2,
              key: messageKey,
            });
          } else {
            messageApiRef.current.destroy(messageKey);
          }
        }).catch(() => {
          messageApiRef.current.destroy(messageKey);
        });
      };
    }, []); // only on unmount

    // Warn before browser tab close / refresh
    useEffect(() => {
      if (!isDirty) return;

      const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        e.preventDefault();
        e.returnValue = message;
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }, [isDirty, message]);

    return null;
  },
);

UnsavedChangesGuard.displayName = 'UnsavedChangesGuard';

export default UnsavedChangesGuard;
