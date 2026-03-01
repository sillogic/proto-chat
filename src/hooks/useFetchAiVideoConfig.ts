import { useEffect, useMemo, useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client/lambda';
import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/slices/aiProvider/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';
import { useVideoStore } from '@/store/video';
import { AiProviderSourceEnum } from '@/types/aiProvider';

const checkModelEnabled = (
  enabledVideoModelList: ReturnType<typeof aiProviderSelectors.enabledVideoModelList>,
  provider: string,
  model: string,
) => {
  return enabledVideoModelList.some(
    (p) => p.id === provider && p.children.some((m) => m.id === model),
  );
};

export const useFetchAiVideoConfig = () => {
  const isStatusInit = useGlobalStore(systemStatusSelectors.isStatusInit);
  const isInitAiProviderRuntimeState = useAiInfraStore(
    aiProviderSelectors.isInitAiProviderRuntimeState,
  );

  const isAuthLoaded = useUserStore(authSelectors.isLoaded);
  const isLogin = useUserStore(authSelectors.isLogin);
  const isActualLogout = isAuthLoaded && isLogin === false;
  const isUserStateInit = useUserStore((s) => s.isUserStateInit);
  const isUserStateReady = isUserStateInit || isActualLogout;

  // undefined = loading; null = not configured; object = configured
  const [systemVideoDefault, setSystemVideoDefault] = useState<
    { displayName: string | null; modelId: string | null; providerId: string | null } | null | undefined
  >(undefined);

  useEffect(() => {
    lambdaClient.config.getVideoDefaultModel
      .query()
      .then((data) => setSystemVideoDefault(data as any))
      .catch(() => setSystemVideoDefault(null));
  }, []);

  const isReadyForInit =
    isStatusInit &&
    isInitAiProviderRuntimeState &&
    isUserStateReady &&
    systemVideoDefault !== undefined;

  // When the system has a default video model configured, replace the entire enabledVideoModelList with it
  // (removes built-in hard-coded models like LobeHub/seedance and keeps only admin-configured models)
  useEffect(() => {
    if (!isInitAiProviderRuntimeState) return;
    if (!systemVideoDefault?.modelId || !systemVideoDefault?.providerId) return;

    // ProtoChat models must be routed through the 'protochat' provider; handles legacy configs that may have stored a sub-provider ID
    const normalizedProviderId = systemVideoDefault.modelId?.startsWith('protochat::')
      ? 'protochat'
      : systemVideoDefault.providerId!;

    const currentList = useAiInfraStore.getState().enabledVideoModelList || [];
    const alreadyOnlyThis =
      currentList.length === 1 &&
      currentList[0].id === normalizedProviderId &&
      currentList[0].children.length === 1 &&
      currentList[0].children[0].id === systemVideoDefault.modelId;
    if (alreadyOnlyThis) return;

    const syntheticProvider = {
      children: [
        {
          // Minimum valid parameters satisfying VideoModelParamsMetaSchema (only prompt is required)
          abilities: { video: true },
          displayName: systemVideoDefault.displayName || systemVideoDefault.modelId,
          id: systemVideoDefault.modelId!,
          parameters: { prompt: {} },
        },
      ],
      id: normalizedProviderId,
      name: normalizedProviderId,
      source: AiProviderSourceEnum.Custom,
    };

    // Replace the entire list, removing built-in hard-coded models
    useAiInfraStore.setState({ enabledVideoModelList: [syntheticProvider] });
  }, [systemVideoDefault, isInitAiProviderRuntimeState]);

  const { lastSelectedVideoModel, lastSelectedVideoProvider } = useGlobalStore((s) => ({
    lastSelectedVideoModel: s.status.lastSelectedVideoModel,
    lastSelectedVideoProvider: s.status.lastSelectedVideoProvider,
  }));
  const isInitializedVideoConfig = useVideoStore((s) => s.isInit);
  const initializeVideoConfig = useVideoStore((s) => s.initializeVideoConfig);

  const enabledVideoModelList = useAiInfraStore(aiProviderSelectors.enabledVideoModelList);

  const initParams = useMemo(() => {
    // 1. Prefer the last selected model (if still enabled)
    if (
      lastSelectedVideoModel &&
      lastSelectedVideoProvider &&
      checkModelEnabled(enabledVideoModelList, lastSelectedVideoProvider, lastSelectedVideoModel)
    ) {
      return { model: lastSelectedVideoModel, provider: lastSelectedVideoProvider };
    }

    // 2. Use the default video model configured in the backend
    if (systemVideoDefault?.modelId && systemVideoDefault?.providerId) {
      if (
        checkModelEnabled(
          enabledVideoModelList,
          systemVideoDefault.providerId,
          systemVideoDefault.modelId,
        )
      ) {
        return { model: systemVideoDefault.modelId, provider: systemVideoDefault.providerId };
      }
      // Cross-provider lookup (in case the providerId mapping differs)
      const providerWithDefault = enabledVideoModelList.find((p) =>
        p.children.some((m) => m.id === systemVideoDefault.modelId),
      );
      if (providerWithDefault) {
        return { model: systemVideoDefault.modelId, provider: providerWithDefault.id };
      }
    }

    // 3. Fall back to the first available model
    const firstProvider = enabledVideoModelList[0];
    const firstModel = firstProvider?.children[0];
    if (firstProvider && firstModel) {
      return { model: firstModel.id, provider: firstProvider.id };
    }

    return { model: undefined, provider: undefined };
  }, [lastSelectedVideoModel, lastSelectedVideoProvider, enabledVideoModelList, systemVideoDefault]);

  useEffect(() => {
    if (!isInitializedVideoConfig && isReadyForInit) {
      initializeVideoConfig(isLogin, initParams.model, initParams.provider);
    }
  }, [isReadyForInit, isInitializedVideoConfig, isLogin, initParams, initializeVideoConfig]);
};
