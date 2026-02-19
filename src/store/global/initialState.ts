import type { ThemeMode } from 'antd-style';
import type { NavigateFunction } from 'react-router-dom';

import { DatabaseLoadingState, MigrationSQL, MigrationTableItem } from '@/types/clientDB';
import { LocaleMode } from '@/types/locale';
import { SessionDefaultGroup } from '@/types/session';
import { AsyncLocalStorage } from '@/utils/localStorage';

export enum SidebarTabKey {
  Chat = 'chat',
  Discover = 'discover',
  Files = 'knowledge',
  Image = 'image',
  Knowledge = 'knowledge',
  Me = 'me',
  Setting = 'settings',
}

export enum ChatSettingsTabs {
  Chat = 'chat',
  Meta = 'meta',
  Modal = 'modal',
  Opening = 'opening',
  Plugin = 'plugin',
  Prompt = 'prompt',
  TTS = 'tts',
}

export enum GroupSettingsTabs {
  Chat = 'chat',
  Members = 'members',
  Settings = 'settings',
}

export enum SettingsTabs {
  About = 'about',
  Agent = 'agent',
  Common = 'common',
  Hotkey = 'hotkey',
  Image = 'image',
  LLM = 'llm',
  Provider = 'provider',
  Proxy = 'proxy',
  Storage = 'storage',
  SystemAgent = 'system-agent',
  TTS = 'tts',
}

export enum ProfileTabs {
  APIKey = 'apikey',
  Billing = 'billing',
  Profile = 'profile',
  Security = 'security',
  Stats = 'stats',
  Usage = 'usage',
}

export interface SystemStatus {
  chatInputHeight?: number;
  disabledModelProvidersSortType?: string;
  disabledModelsSortType?: string;
  expandInputActionbar?: boolean;
  // which sessionGroup should expand
  expandSessionGroupKeys: string[];
  fileManagerViewMode?: 'list' | 'masonry';
  filePanelWidth: number;
  hideGemini2_5FlashImagePreviewChineseWarning?: boolean;
  hidePWAInstaller?: boolean;
  hideThreadLimitAlert?: boolean;
  imagePanelWidth: number;
  imageTopicPanelWidth?: number;
  /**
   * PGLite is not enabled during application initialization; it is only enabled when the user manually activates it
   */
  isEnablePglite?: boolean;
  isShowCredit?: boolean;
  knowledgeBaseModalViewMode?: 'list' | 'masonry';
  language?: LocaleMode;
  /**
   * Remembers the last image generation model selected by the user
   */
  lastSelectedImageModel?: string;
  /**
   * Remembers the last image generation provider selected by the user
   */
  lastSelectedImageProvider?: string;
  latestChangelogId?: string;
  mobileShowPortal?: boolean;
  mobileShowTopic?: boolean;
  noWideScreen?: boolean;
  portalWidth: number;
  sessionsWidth: number;
  showChatSideBar?: boolean;
  showFilePanel?: boolean;
  showHotkeyHelper?: boolean;
  showImagePanel?: boolean;
  showImageTopicPanel?: boolean;
  showSessionPanel?: boolean;
  showSystemRole?: boolean;
  systemRoleExpandedMap: Record<string, boolean>;
  /**
   * theme mode
   */
  themeMode?: ThemeMode;
  /**
   * Whether to display tokens in short format
   */
  tokenDisplayFormatShort?: boolean;
  zenMode?: boolean;
}

export interface GlobalState {
  hasNewVersion?: boolean;
  initClientDBError?: Error;
  initClientDBMigrations?: {
    sqls: MigrationSQL[];
    tableRecords: MigrationTableItem[];
  };

  initClientDBProcess?: { costTime?: number; phase: 'wasm' | 'dependencies'; progress: number };
  /**
   * Client database initialization status
   * Idle at startup, Ready when complete, Error when an error occurs
   */
  initClientDBStage: DatabaseLoadingState;
  isMobile?: boolean;
  isStatusInit?: boolean;
  latestVersion?: string;
  navigate?: NavigateFunction;
  sidebarKey: SidebarTabKey;
  status: SystemStatus;
  statusStorage: AsyncLocalStorage<SystemStatus>;
}

export const INITIAL_STATUS = {
  chatInputHeight: 64,
  disabledModelProvidersSortType: 'default',
  disabledModelsSortType: 'default',
  expandInputActionbar: true,
  expandSessionGroupKeys: [SessionDefaultGroup.Pinned, SessionDefaultGroup.Default],
  fileManagerViewMode: 'list' as const,
  filePanelWidth: 320,
  hideGemini2_5FlashImagePreviewChineseWarning: false,
  hidePWAInstaller: false,
  hideThreadLimitAlert: false,
  imagePanelWidth: 320,
  imageTopicPanelWidth: 80,
  knowledgeBaseModalViewMode: 'list' as const,
  mobileShowTopic: false,
  noWideScreen: true,
  portalWidth: 400,
  sessionsWidth: 320,
  showChatSideBar: true,
  showFilePanel: true,
  showHotkeyHelper: false,
  showImagePanel: true,
  showImageTopicPanel: true,
  showSessionPanel: true,
  showSystemRole: false,
  systemRoleExpandedMap: {},
  themeMode: 'auto',
  tokenDisplayFormatShort: true,
  zenMode: false,
} satisfies SystemStatus;

export const initialState: GlobalState = {
  initClientDBStage: DatabaseLoadingState.Idle,
  isMobile: false,
  isStatusInit: false,
  sidebarKey: SidebarTabKey.Chat,
  status: INITIAL_STATUS,
  statusStorage: new AsyncLocalStorage('LOBE_SYSTEM_STATUS'),
};
