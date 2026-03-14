'use client';

import { ChatInput } from '@lobehub/editor/react';
import { Button, Flexbox, TextArea } from '@lobehub/ui';
import { App, Select, Typography } from 'antd';
import { createStaticStyles, cx } from 'antd-style';
import { Sparkles, Wand2, X, Check } from 'lucide-react';
import { type KeyboardEvent } from 'react';
import { useEffect, useRef, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';

import { loginRequired } from '@/components/Error/loginRequiredNotification';
import { useIsDark } from '@/hooks/useIsDark';
import { useQueryState } from '@/hooks/useQueryParam';
import { aiProviderSelectors, useAiInfraStore } from '@/store/aiInfra';
import { useImageStore } from '@/store/image';
import { createImageSelectors } from '@/store/image/selectors';
import { useGenerationConfigParam } from '@/store/image/slices/generationConfig/hooks';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/slices/auth/selectors';
import { imageService } from '@/services/image';

import PromptTitle from './Title';

const { Text } = Typography;

interface PromptInputProps {
  disableAnimation?: boolean;
  showTitle?: boolean;
}

const styles = createStaticStyles(({ css, cssVar }) => ({
  container: css`
    box-shadow:
      ${cssVar.boxShadowTertiary},
      0 0 0 ${cssVar.colorBgContainer},
      0 32px 0 ${cssVar.colorBgContainer};
  `,
  container_dark: css`
    box-shadow:
      ${cssVar.boxShadowTertiary},
      0 0 48px 32px ${cssVar.colorBgContainer},
      0 32px 0 ${cssVar.colorBgContainer};
  `,
}));

const PromptInput = ({ showTitle = false }: PromptInputProps) => {
  const isDarkMode = useIsDark();
  const { t } = useTranslation('image');
  const { t: tError } = useTranslation('error');
  const { notification } = App.useApp();
  const navigate = useNavigate();
  const { value, setValue } = useGenerationConfigParam('prompt');
  const isCreating = useImageStore(createImageSelectors.isCreating);
  const createImage = useImageStore((s) => s.createImage);
  const setModelAndProviderOnSelect = useImageStore((s) => s.setModelAndProviderOnSelect);
  const isInit = useImageStore((s) => s.isInit);
  const isLogin = useUserStore(authSelectors.isLogin);
  const enabledImageModelList = useAiInfraStore(aiProviderSelectors.enabledImageModelList);
  const enabledChatModelList = useAiInfraStore((s) => s.enabledChatModelList || []);

  // Prompt optimizer state
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizedPrompt, setOptimizedPrompt] = useState<string | null>(null);
  const [optimizerModelId, setOptimizerModelId] = useState<string>('');

  // ProtoChat chat models for the optimizer selector
  const protoChatModelOptions = useMemo(() => {
    const options: { label: string; value: string }[] = [];
    for (const group of enabledChatModelList) {
      if (!group.id.startsWith('protochat')) continue;
      for (const m of group.children ?? []) {
        options.push({
          label: m.displayName || m.id,
          value: m.id,
        });
      }
    }
    return options;
  }, [enabledChatModelList]);

  // Auto-select preferred ProtoChat model when list loads (Gemini 2.5 Flash preferred)
  useEffect(() => {
    if (!optimizerModelId && protoChatModelOptions.length > 0) {
      const preferred = protoChatModelOptions.find(
        (m) =>
          m.value.toLowerCase().includes('gemini-2.5-flash') ||
          (typeof m.label === 'string' && m.label.toLowerCase().includes('gemini 2.5 flash')),
      );
      setOptimizerModelId((preferred ?? protoChatModelOptions[0]).value);
    }
  }, [protoChatModelOptions, optimizerModelId]);

  // Read prompt from query parameter
  const [promptParam, setPromptParam] = useQueryState('prompt');
  // Read model from query parameter
  const [modelParam, setModelParam] = useQueryState('model');
  const hasProcessedPrompt = useRef(false);
  const hasProcessedModel = useRef(false);

  const showInsufficientCreditsNotification = () => {
    notification.warning({
      btn: (
        <Button size={'small'} type={'primary'} onClick={() => navigate('/settings/plans')}>
          {tError('credits.upgradeNow')}
        </Button>
      ),
      description: tError('credits.image.description'),
      duration: 6,
      message: tError('credits.image.title'),
    });
  };

  const handleGenerate = async () => {
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }

    try {
      await createImage();
    } catch (e: any) {
      if (e?.message === 'INSUFFICIENT_CREDITS') {
        showInsufficientCreditsNotification();
      }
    }
  };

  const handleOptimize = async () => {
    if (!value.trim() || !optimizerModelId) return;
    if (!isLogin) {
      loginRequired.redirect({ timeout: 2000 });
      return;
    }
    setIsOptimizing(true);
    setOptimizedPrompt(null);
    try {
      const result = await imageService.optimizePrompt(value.trim(), optimizerModelId);
      if (result) setOptimizedPrompt(result);
    } finally {
      setIsOptimizing(false);
    }
  };

  const handleApplyOptimized = () => {
    if (optimizedPrompt) {
      setValue(optimizedPrompt);
      setOptimizedPrompt(null);
    }
  };

  // Auto-select model when model query parameter is present
  useEffect(() => {
    if (modelParam && !hasProcessedModel.current && isInit) {
      const targetModel = modelParam;

      // Find the provider for this model from enabledImageModelList
      for (const providerGroup of enabledImageModelList) {
        const found = providerGroup.children.some((m) => m.id === targetModel);
        if (found) {
          setModelAndProviderOnSelect(targetModel, providerGroup.id);
          break;
        }
      }

      hasProcessedModel.current = true;
      setModelParam(null);
    }
  }, [modelParam, isInit, enabledImageModelList, setModelAndProviderOnSelect, setModelParam]);

  // Auto-fill and auto-send when prompt query parameter is present
  useEffect(() => {
    if (promptParam && !hasProcessedPrompt.current && isLogin) {
      // Decode the prompt parameter
      const decodedPrompt = decodeURIComponent(promptParam);

      // Set the prompt value in the store
      setValue(decodedPrompt);

      // Mark as processed to avoid running this effect again
      hasProcessedPrompt.current = true;

      // Clear the query parameter
      setPromptParam(null);

      // Auto-trigger generation after a short delay to ensure state is updated
      setTimeout(async () => {
        try {
          await createImage();
        } catch (e: any) {
          if (e?.message === 'INSUFFICIENT_CREDITS') {
            showInsufficientCreditsNotification();
          }
        }
      }, 100);
    }
  }, [promptParam, isLogin, setValue, setPromptParam, createImage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      if (!isCreating && value.trim()) {
        handleGenerate();
      }
    }
  };

  const showOptimizer = protoChatModelOptions.length > 0;

  return (
    <Flexbox gap={32} width={'100%'}>
      {showTitle && <PromptTitle />}
      <ChatInput
        className={cx(styles.container, isDarkMode && styles.container_dark)}
        styles={{ body: { padding: 8 } }}
      >
        <Flexbox gap={8} width={'100%'}>

          {/* Optimized prompt result card */}
          {optimizedPrompt && (
            <Flexbox
              style={{
                background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(22,119,255,0.04)',
                border: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.1)' : 'rgba(22,119,255,0.2)'}`,
                borderRadius: 8,
                padding: '10px 12px',
              }}
              gap={8}
            >
              <Flexbox horizontal justify="space-between" align="flex-start">
                <Text style={{ color: '#1677ff', fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  ✨ 优化结果
                </Text>
                <Button
                  size="small"
                  type="text"
                  icon={X}
                  style={{ color: '#8c8c8c', height: 20, minWidth: 20, padding: 0 }}
                  onClick={() => setOptimizedPrompt(null)}
                />
              </Flexbox>
              <Text style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {optimizedPrompt}
              </Text>
              <Button
                size="small"
                type="primary"
                icon={Check}
                onClick={handleApplyOptimized}
                style={{ alignSelf: 'flex-end' }}
              >
                使用此提示词
              </Button>
            </Flexbox>
          )}

          {/* Main input row */}
          <Flexbox horizontal align="flex-end" gap={12} width={'100%'}>
            <TextArea
              autoSize={{ maxRows: 6, minRows: 3 }}
              placeholder={t('config.prompt.placeholder')}
              value={value}
              variant={'borderless'}
              style={{ borderRadius: 0, padding: 0 }}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <Button
              disabled={!value}
              icon={Sparkles}
              loading={isCreating}
              size={'large'}
              type={'primary'}
              style={{ fontWeight: 500, height: 64, minWidth: 64, width: 64 }}
              title={isCreating ? t('generation.status.generating') : t('generation.actions.generate')}
              onClick={handleGenerate}
            />
          </Flexbox>

          {/* Optimizer toolbar */}
          {showOptimizer && (
            <Flexbox
              horizontal
              align="center"
              gap={6}
              style={{
                borderTop: `1px solid ${isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                paddingTop: 6,
              }}
            >
              {/* Section identity badge */}
              <Flexbox
                horizontal
                align="center"
                gap={4}
                style={{
                  background: isDarkMode ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                  borderRadius: 4,
                  flexShrink: 0,
                  padding: '2px 6px',
                }}
              >
                <Wand2
                  size={10}
                  style={{ color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)' }}
                />
                <span
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    fontSize: 10,
                    fontWeight: 500,
                    letterSpacing: '0.04em',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  提示词优化
                </span>
              </Flexbox>

              {/* Spacer */}
              <div style={{ flex: 1 }} />

              {/* Model selector with explicit label */}
              <Flexbox horizontal align="center" gap={4} style={{ flexShrink: 0 }}>
                <span
                  style={{
                    color: isDarkMode ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    fontSize: 11,
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  AI 模型
                </span>
                <Select
                  size="small"
                  value={optimizerModelId || undefined}
                  onChange={setOptimizerModelId}
                  options={protoChatModelOptions}
                  placeholder="选择模型"
                  style={{ width: 160 }}
                  variant="borderless"
                />
              </Flexbox>

              <Button
                size="small"
                icon={Wand2}
                loading={isOptimizing}
                disabled={!value.trim() || !optimizerModelId}
                onClick={handleOptimize}
                style={{ flexShrink: 0 }}
              >
                优化
              </Button>
            </Flexbox>
          )}

        </Flexbox>
      </ChatInput>
    </Flexbox>
  );
};

export default PromptInput;
