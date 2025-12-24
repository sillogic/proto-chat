import qs from 'query-string';
import urlJoin from 'url-join';

import { INBOX_SESSION_ID } from './session';

const isDev = process.env.NODE_ENV === 'development';

export const UTM_SOURCE = 'chat_preview';

export const OFFICIAL_URL = 'https://protochat.ai';
export const OFFICIAL_SITE = 'https://protochat.ai';
export const OFFICIAL_DOMAIN = 'protochat.ai';

export const OG_URL = '/og/cover.png?v=1';

export const GITHUB = 'https://github.com/protochat';
export const GITHUB_ISSUES = 'https://github.com/protochat/protochat/issues';
export const CHANGELOG = 'https://protochat.ai/changelog';

export const DOCUMENTS = 'https://docs.protochat.ai';
export const USAGE_DOCUMENTS = 'https://docs.protochat.ai/usage';
export const SELF_HOSTING_DOCUMENTS = 'https://docs.protochat.ai/self-hosting';
export const DATABASE_SELF_HOSTING_URL = 'https://docs.protochat.ai/self-hosting/database';

// use this for the link
export const DOCUMENTS_REFER_URL = 'https://docs.protochat.ai';

export const WIKI_PLUGIN_GUIDE = 'https://docs.protochat.ai/plugin-guide';
export const MANUAL_UPGRADE_URL = 'https://docs.protochat.ai/upgrade';

export const BLOG = 'https://protochat.ai/blog';

export const ABOUT = OFFICIAL_SITE;
export const FEEDBACK = 'https://github.com/protochat/protochat/discussions';
export const PRIVACY_URL = urlJoin(OFFICIAL_SITE, '/privacy');
export const TERMS_URL = urlJoin(OFFICIAL_SITE, '/terms');

export const PLUGINS_INDEX_URL = 'https://protochat.ai/plugins';

export const MORE_MODEL_PROVIDER_REQUEST_URL = 'https://protochat.ai/request-provider';

export const MORE_FILE_PREVIEW_REQUEST_URL = 'https://protochat.ai/request-preview';

export const AGENTS_INDEX_GITHUB = 'https://github.com/protochat/agents';
export const AGENTS_INDEX_GITHUB_ISSUE = 'https://github.com/protochat/agents/issues';
export const AGENTS_OFFICIAL_URL = 'https://protochat.ai/agents';

export const SESSION_CHAT_URL = (id: string = INBOX_SESSION_ID, mobile?: boolean) =>
  qs.stringifyUrl({
    query: mobile ? { session: id, showMobileWorkspace: mobile } : { session: id },
    url: '/chat',
  });

export const imageUrl = (filename: string) => `/images/${filename}`;

export const LOBE_URL_IMPORT_NAME = 'settings';

export const RELEASES_URL = 'https://github.com/protochat/protochat/releases';

export const mailTo = (email: string) => `mailto:${email}`;

export const AES_GCM_URL = 'https://datatracker.ietf.org/doc/html/draft-ietf-avt-srtp-aes-gcm-01';
export const BASE_PROVIDER_DOC_URL = 'https://docs.protochat.ai/provider-guide';
export const SITEMAP_BASE_URL = isDev ? '/sitemap.xml/' : 'sitemap';
export const CHANGELOG_URL = 'https://protochat.ai/changelog';
