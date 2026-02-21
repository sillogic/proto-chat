export type StorageMode = 'local' | 'cloud' | 'selfHost';
export enum StorageModeEnum {
  Cloud = 'cloud',
  Local = 'local',
  SelfHost = 'selfHost',
}

/**
 * Remote server configuration-related data sync config
 */
export interface DataSyncConfig {
  active?: boolean;
  remoteServerUrl?: string;
  storageMode: StorageMode;
}
