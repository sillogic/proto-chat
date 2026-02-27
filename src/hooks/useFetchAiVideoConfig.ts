import { useEffect, useMemo, useState } from 'react';

import { lambdaClient } from '@/libs/trpc/client/lambda';
import { useAiInfraStore } from '@/store/aiInfra';
import { aiProviderSelectors } from '@/store/aiInfra/slices/aiProvider/selectors';
import { useGlobalStore } from '@/store/global';
import { systemStatusSelectors } from '@/store/global/selectors';
import { useVideoStore } from '@/store/video';
import { useUserStore } from '@/store/user';
import { authSelectors } from '@/store/user/selectors';
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

  // undefined = 加载中; null = 未配置; object = 已配置
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

  // 当系统配置了视频默认模型时，用该模型替换整个 enabledVideoModelList
  // （移除内置的 LobeHub/seedance 等硬编码模型，仅保留管理员配置的模型）
  useEffect(() => {
    if (!isInitAiProviderRuntimeState) return;
    if (!systemVideoDefault?.modelId || !systemVideoDefault?.providerId) return;

    // ProtoChat 模型必须通过 'protochat' 供应商路由；兼容旧配置中可能保存了子供应商 ID 的情况
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
          // 最小合法 parameters，满足 VideoModelParamsMetaSchema（仅 prompt 必填）
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

    // 替换整个列表，去掉内置硬编码模型
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
    // 1. 优先使用上次选择的模型（仍启用时）
    if (
      lastSelectedVideoModel &&
      lastSelectedVideoProvider &&
      checkModelEnabled(enabledVideoModelList, lastSelectedVideoProvider, lastSelectedVideoModel)
    ) {
      return { model: lastSelectedVideoModel, provider: lastSelectedVideoProvider };
    }

    // 2. 使用后台配置的视频默认模型
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
      // 跨供应商查找（以防 providerId 映射不同）
      const providerWithDefault = enabledVideoModelList.find((p) =>
        p.children.some((m) => m.id === systemVideoDefault.modelId),
      );
      if (providerWithDefault) {
        return { model: systemVideoDefault.modelId, provider: providerWithDefault.id };
      }
    }

    // 3. 降级到第一个可用模型
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
