import {
  KLAVIS_SERVER_TYPES,
  LOBEHUB_SKILL_PROVIDERS,
  RECOMMENDED_SKILLS,
  RecommendedSkillType,
} from '@lobechat/const';
import { type ItemType } from '@lobehub/ui';
import { Avatar, Icon } from '@lobehub/ui';
import isEqual from 'fast-deep-equal';
import { ToyBrick } from 'lucide-react';
import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import PluginAvatar from '@/components/Plugins/PluginAvatar';
import { useCheckPluginsIsInstalled } from '@/hooks/useCheckPluginsIsInstalled';
import { useFetchInstalledPlugins } from '@/hooks/useFetchInstalledPlugins';
import { useAgentStore } from '@/store/agent';
import { agentByIdSelectors } from '@/store/agent/selectors';
import { serverConfigSelectors, useServerConfigStore } from '@/store/serverConfig';
import { useToolStore } from '@/store/tool';
import {
  builtinToolSelectors,
  klavisStoreSelectors,
  lobehubSkillStoreSelectors,
  pluginSelectors,
} from '@/store/tool/selectors';

import { useAgentId } from '../../hooks/useAgentId';
import KlavisServerItem from './KlavisServerItem';
import KlavisSkillIcon from './KlavisSkillIcon';
import LobehubSkillIcon from './LobehubSkillIcon';
import LobehubSkillServerItem from './LobehubSkillServerItem';
import ToolItem from './ToolItem';

const SKILL_ICON_SIZE = 20;

export const useControls = ({ setUpdating }: { setUpdating: (updating: boolean) => void }) => {
  const { t } = useTranslation('setting');
  const agentId = useAgentId();
  const list = useToolStore(pluginSelectors.installedPluginMetaList, isEqual);
  const [checked, togglePlugin] = useAgentStore((s) => [
    agentByIdSelectors.getAgentPluginsById(agentId)(s),
    s.togglePlugin,
  ]);
  const builtinList = useToolStore(builtinToolSelectors.metaList, isEqual);
  const plugins = useAgentStore((s) => agentByIdSelectors.getAgentPluginsById(agentId)(s));

  // Klavis-related state
  const allKlavisServers = useToolStore(klavisStoreSelectors.getServers, isEqual);
  const isKlavisEnabledInEnv = useServerConfigStore(serverConfigSelectors.enableKlavis);

  // LobeHub Skill-related state
  const allLobehubSkillServers = useToolStore(lobehubSkillStoreSelectors.getServers, isEqual);
  const isLobehubSkillEnabled = useServerConfigStore(serverConfigSelectors.enableLobehubSkill);

  const [
    useFetchPluginStore,
    useFetchUserKlavisServers,
    useFetchLobehubSkillConnections,
    useFetchUninstalledBuiltinTools,
  ] = useToolStore((s) => [
    s.useFetchPluginStore,
    s.useFetchUserKlavisServers,
    s.useFetchLobehubSkillConnections,
    s.useFetchUninstalledBuiltinTools,
  ]);

  useFetchPluginStore();
  useFetchInstalledPlugins();
  useFetchUninstalledBuiltinTools(true);
  useCheckPluginsIsInstalled(plugins);

  // Load user's Klavis integrations via SWR (from database)
  useFetchUserKlavisServers(isKlavisEnabledInEnv);

  // Load user's LobeHub Skill connections via SWR
  useFetchLobehubSkillConnections(isLobehubSkillEnabled);

  // Get connected server by identifier
  const getServerByName = (identifier: string) => {
    return allKlavisServers.find((server) => server.identifier === identifier);
  };

  // Get the set of all Klavis server type identifiers (used to filter builtinList)
  // Use KLAVIS_SERVER_TYPES instead of connected servers, as we want to filter out all possible Klavis types
  const allKlavisTypeIdentifiers = useMemo(
    () => new Set(KLAVIS_SERVER_TYPES.map((type) => type.identifier)),
    [],
  );
  // Filter out klavis tools from builtinList (they are displayed separately in the Klavis section)
  const filteredBuiltinList = useMemo(
    () =>
      isKlavisEnabledInEnv
        ? builtinList.filter((item) => !allKlavisTypeIdentifiers.has(item.identifier))
        : builtinList,
    [builtinList, allKlavisTypeIdentifiers, isKlavisEnabledInEnv],
  );

  // Get recommended Klavis skill IDs
  const recommendedKlavisIds = useMemo(
    () =>
      new Set(
        RECOMMENDED_SKILLS.filter((s) => s.type === RecommendedSkillType.Klavis).map((s) => s.id),
      ),
    [],
  );

  // Get recommended LobeHub skill IDs
  const recommendedLobehubIds = useMemo(
    () =>
      new Set(
        RECOMMENDED_SKILLS.filter((s) => s.type === RecommendedSkillType.Lobehub).map((s) => s.id),
      ),
    [],
  );

  // Get installed Klavis server IDs
  const installedKlavisIds = useMemo(
    () => new Set(allKlavisServers.map((s) => s.identifier)),
    [allKlavisServers],
  );

  // Get installed LobeHub skill IDs
  const installedLobehubIds = useMemo(
    () => new Set(allLobehubSkillServers.map((s) => s.identifier)),
    [allLobehubSkillServers],
  );

  // Klavis server list items - only show installed or recommended
  const klavisServerItems = useMemo(
    () =>
      isKlavisEnabledInEnv
        ? KLAVIS_SERVER_TYPES.filter(
            (type) =>
              installedKlavisIds.has(type.identifier) || recommendedKlavisIds.has(type.identifier),
          ).map((type) => ({
            icon: <KlavisSkillIcon icon={type.icon} label={type.label} size={SKILL_ICON_SIZE} />,
            key: type.identifier,
            label: (
              <KlavisServerItem
                agentId={agentId}
                identifier={type.identifier}
                label={type.label}
                server={getServerByName(type.identifier)}
                serverName={type.serverName}
              />
            ),
          }))
        : [],
    [isKlavisEnabledInEnv, allKlavisServers, installedKlavisIds, recommendedKlavisIds, agentId],
  );

  // LobeHub Skill Provider list items - only show installed or recommended
  const lobehubSkillItems = useMemo(
    () =>
      isLobehubSkillEnabled
        ? LOBEHUB_SKILL_PROVIDERS.filter(
            (provider) =>
              installedLobehubIds.has(provider.id) || recommendedLobehubIds.has(provider.id),
          ).map((provider) => ({
            icon: (
              <LobehubSkillIcon
                icon={provider.icon}
                label={provider.label}
                size={SKILL_ICON_SIZE}
              />
            ),
            key: provider.id, // Use provider.id as key, consistent with pluginId
            label: (
              <LobehubSkillServerItem
                agentId={agentId}
                label={provider.label}
                provider={provider.id}
              />
            ),
          }))
        : [],
    [
      isLobehubSkillEnabled,
      allLobehubSkillServers,
      installedLobehubIds,
      recommendedLobehubIds,
      agentId,
    ],
  );

  // Builtin tool list items (excluding Klavis and LobeHub Skill)
  const builtinItems = useMemo(
    () =>
      filteredBuiltinList.map((item) => ({
        icon: (
          <Avatar
            avatar={item.meta.avatar}
            shape={'square'}
            size={SKILL_ICON_SIZE}
            style={{ flex: 'none' }}
          />
        ),
        key: item.identifier,
        label: (
          <ToolItem
            checked={checked.includes(item.identifier)}
            id={item.identifier}
            label={item.meta?.title}
            onUpdate={async () => {
              setUpdating(true);
              await togglePlugin(item.identifier);
              setUpdating(false);
            }}
          />
        ),
      })),
    [filteredBuiltinList, checked, togglePlugin, setUpdating],
  );

  // Skill list items (including LobeHub Skill and Klavis)
  // Connected items come first
  const skillItems = useMemo(() => {
    const allItems = [...lobehubSkillItems, ...klavisServerItems];

    return allItems.sort((a, b) => {
      const isConnectedA =
        installedLobehubIds.has(a.key as string) || installedKlavisIds.has(a.key as string);
      const isConnectedB =
        installedLobehubIds.has(b.key as string) || installedKlavisIds.has(b.key as string);

      if (isConnectedA && !isConnectedB) return -1;
      if (!isConnectedA && isConnectedB) return 1;
      return 0;
    });
  }, [lobehubSkillItems, klavisServerItems, installedLobehubIds, installedKlavisIds]);

  // Distinguish between community and custom plugins
  const communityPlugins = list.filter((item) => item.type !== 'customPlugin');
  const customPlugins = list.filter((item) => item.type === 'customPlugin');

  // Function to generate plugin list items
  const mapPluginToItem = (item: (typeof list)[0]) => ({
    icon: item?.avatar ? (
      <PluginAvatar avatar={item.avatar} size={SKILL_ICON_SIZE} />
    ) : (
      <Icon icon={ToyBrick} size={SKILL_ICON_SIZE} />
    ),
    key: item.identifier,
    label: (
      <ToolItem
        checked={checked.includes(item.identifier)}
        id={item.identifier}
        label={item.title}
        onUpdate={async () => {
          setUpdating(true);
          await togglePlugin(item.identifier);
          setUpdating(false);
        }}
      />
    ),
  });

  // Build children for the LobeHub group (including builtin tools and LobeHub Skill/Klavis)
  const lobehubGroupChildren: ItemType[] = [
    // 1. Builtin tools
    ...builtinItems,
    // 2. LobeHub Skill and Klavis (as builtin skills)
    ...skillItems,
  ];

  // Build children for the Community group (community plugins only)
  const communityGroupChildren: ItemType[] = communityPlugins.map(mapPluginToItem);

  // Build children for the Custom group (custom plugins only)
  const customGroupChildren: ItemType[] = customPlugins.map(mapPluginToItem);

  // Items for the marketplace tab
  const marketItems: ItemType[] = [
    // LobeHub group
    ...(lobehubGroupChildren.length > 0
      ? [
          {
            children: lobehubGroupChildren,
            key: 'lobehub',
            label: t('skillStore.tabs.lobehub'),
            type: 'group' as const,
          },
        ]
      : []),
    // Community group
    ...(communityGroupChildren.length > 0
      ? [
          {
            children: communityGroupChildren,
            key: 'community',
            label: t('skillStore.tabs.community'),
            type: 'group' as const,
          },
        ]
      : []),
    // Custom group (only shown when there are custom plugins)
    ...(customGroupChildren.length > 0
      ? [
          {
            children: customGroupChildren,
            key: 'custom',
            label: t('skillStore.tabs.custom'),
            type: 'group' as const,
          },
        ]
      : []),
  ];

  // Items for the installed tab - only shows installed plugins
  const installedPluginItems: ItemType[] = useMemo(() => {
    const installedItems: ItemType[] = [];

    // Installed builtin tools
    const enabledBuiltinItems = filteredBuiltinList
      .filter((item) => checked.includes(item.identifier))
      .map((item) => ({
        icon: (
          <Avatar
            avatar={item.meta.avatar}
            shape={'square'}
            size={SKILL_ICON_SIZE}
            style={{ flex: 'none' }}
          />
        ),
        key: item.identifier,
        label: (
          <ToolItem
            checked={true}
            id={item.identifier}
            label={item.meta?.title}
            onUpdate={async () => {
              setUpdating(true);
              await togglePlugin(item.identifier);
              setUpdating(false);
            }}
          />
        ),
      }));

    // Connected Klavis servers
    const connectedKlavisItems = klavisServerItems.filter((item) =>
      checked.includes(item.key as string),
    );

    // Connected LobeHub Skill Providers
    const connectedLobehubSkillItems = lobehubSkillItems.filter((item) =>
      checked.includes(item.key as string),
    );

    // Merge enabled LobeHub Skill and Klavis (as builtin skills)
    const enabledSkillItems = [...connectedLobehubSkillItems, ...connectedKlavisItems];

    // Build children for the builtin tools group (including builtin tools and LobeHub Skill/Klavis)
    const allBuiltinItems: ItemType[] = [
      // 1. Builtin tools
      ...enabledBuiltinItems,
      // 2. divider (if there are builtin tools and skill items)
      ...(enabledBuiltinItems.length > 0 && enabledSkillItems.length > 0
        ? [{ key: 'installed-divider-builtin-skill', type: 'divider' as const }]
        : []),
      // 3. LobeHub Skill and Klavis
      ...enabledSkillItems,
    ];

    if (allBuiltinItems.length > 0) {
      installedItems.push({
        children: allBuiltinItems,
        key: 'installed-lobehub',
        label: t('skillStore.tabs.lobehub'),
        type: 'group',
      });
    }

    // Enabled community plugins
    const enabledCommunityPlugins = communityPlugins
      .filter((item) => checked.includes(item.identifier))
      .map((item) => ({
        icon: item?.avatar ? (
          <PluginAvatar avatar={item.avatar} size={SKILL_ICON_SIZE} />
        ) : (
          <Icon icon={ToyBrick} size={SKILL_ICON_SIZE} />
        ),
        key: item.identifier,
        label: (
          <ToolItem
            checked={true}
            id={item.identifier}
            label={item.title}
            onUpdate={async () => {
              setUpdating(true);
              await togglePlugin(item.identifier);
              setUpdating(false);
            }}
          />
        ),
      }));

    // Enabled custom plugins
    const enabledCustomPlugins = customPlugins
      .filter((item) => checked.includes(item.identifier))
      .map((item) => ({
        icon: item?.avatar ? (
          <PluginAvatar avatar={item.avatar} size={SKILL_ICON_SIZE} />
        ) : (
          <Icon icon={ToyBrick} size={SKILL_ICON_SIZE} />
        ),
        key: item.identifier,
        label: (
          <ToolItem
            checked={true}
            id={item.identifier}
            label={item.title}
            onUpdate={async () => {
              setUpdating(true);
              await togglePlugin(item.identifier);
              setUpdating(false);
            }}
          />
        ),
      }));

    // Community group (community plugins only)
    if (enabledCommunityPlugins.length > 0) {
      installedItems.push({
        children: enabledCommunityPlugins,
        key: 'installed-community',
        label: t('skillStore.tabs.community'),
        type: 'group',
      });
    }

    // Custom group (custom plugins only)
    if (enabledCustomPlugins.length > 0) {
      installedItems.push({
        children: enabledCustomPlugins,
        key: 'installed-custom',
        label: t('skillStore.tabs.custom'),
        type: 'group',
      });
    }

    return installedItems;
  }, [
    filteredBuiltinList,
    communityPlugins,
    customPlugins,
    klavisServerItems,
    lobehubSkillItems,
    checked,
    togglePlugin,
    setUpdating,
    t,
  ]);

  return { installedPluginItems, marketItems };
};
