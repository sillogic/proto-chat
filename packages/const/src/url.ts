import qs from 'query-string';
import urlJoin from 'url-join';

import { INBOX_SESSION_ID } from './session';

const isDev = process.env.NODE_ENV === 'development';

export const UTM_SOURCE = 'chat_preview';

export const OFFICIAL_URL = 'https://protochat.ai';
export const OFFICIAL_SITE = 'https://protochat.ai';
export const OFFICIAL_DOMAIN = 'protochat.ai';

export const OG_URL = '/og/cover.png?v=1';

export const GITHUB = '';
export const GITHUB_ISSUES = '';
export const CHANGELOG = '';

export const DOCUMENTS = '';
export const USAGE_DOCUMENTS = '';
export const SELF_HOSTING_DOCUMENTS = '';
export const DATABASE_SELF_HOSTING_URL = '';

// use this for the link
export const DOCUMENTS_REFER_URL = '';

export const WIKI_PLUGIN_GUIDE = '';
export const MANUAL_UPGRADE_URL = '';

export const BLOG = '';

export const ABOUT = OFFICIAL_SITE;
export const FEEDBACK = '';
export const PRIVACY_URL = urlJoin(OFFICIAL_SITE, '/privacy');
export const TERMS_URL = urlJoin(OFFICIAL_SITE, '/terms');

export const PLUGINS_INDEX_URL = '';

export const MORE_MODEL_PROVIDER_REQUEST_URL = '';

export const MORE_FILE_PREVIEW_REQUEST_URL = '';

export const AGENTS_INDEX_GITHUB = '';
export const AGENTS_INDEX_GITHUB_ISSUE = '';
export const AGENTS_OFFICIAL_URL = '';

export const SESSION_CHAT_URL = (id: string = INBOX_SESSION_ID, mobile?: boolean) =>
  qs.stringifyUrl({
    query: mobile ? { session: id, showMobileWorkspace: mobile } : { session: id },
    url: '/chat',
  });

export const imageUrl = (filename: string) => `/images/${filename}`;

export const LOBE_URL_IMPORT_NAME = 'settings';

export const RELEASES_URL = '';

export const mailTo = (email: string) => `mailto:${email}`;

export const AES_GCM_URL = 'https://datatracker.ietf.org/doc/html/draft-ietf-avt-srtp-aes-gcm-01';
export const BASE_PROVIDER_DOC_URL = '';
export const SITEMAP_BASE_URL = isDev ? '/sitemap.xml/' : 'sitemap';
export const CHANGELOG_URL = '';
