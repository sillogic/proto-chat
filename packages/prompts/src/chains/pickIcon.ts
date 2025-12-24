import { ChatStreamPayload } from '@lobechat/types';

/**
 * Available icon identifiers that can be selected
 * These correspond to Lucide icons used in the IconPicker component
 */
const AVAILABLE_ICONS = [
  'bar-chart-3',
  'beaker',
  'book-open',
  'bot',
  'brain',
  'briefcase',
  'calculator',
  'check-circle',
  'clapperboard',
  'clipboard-list',
  'code',
  'compass',
  'database',
  'dices',
  'dumbbell',
  'edit-3',
  'file-text',
  'flask',
  'gamepad-2',
  'globe',
  'graduation-cap',
  'heart',
  'help-circle',
  'home',
  'image',
  'joystick',
  'laptop',
  'mail',
  'map',
  'message',
  'mic',
  'microscope',
  'music',
  'paintbrush',
  'palette',
  'pen-tool',
  'plane',
  'rocket',
  'scale',
  'search',
  'settings',
  'shield',
  'shopping-cart',
  'spade',
  'sparkles',
  'star',
  'target',
  'terminal',
  'trending-up',
  'user',
  'users',
  'utensils',
  'video',
  'wand-2',
  'wrench',
  'zap',
];

/**
 * Pick an icon identifier for user prompt
 * Returns an icon identifier with 'icon:' prefix
 * @param content - The content to analyze for icon selection
 */
export const chainPickIcon = (content: string): Partial<ChatStreamPayload> => ({
  messages: [
    {
      content: `You are an icon selector that chooses the most appropriate icon to represent concepts, topics, or activities.

Available icons (output ONLY one of these exact identifiers with 'icon:' prefix):
${AVAILABLE_ICONS.map((icon) => `- ${icon}`).join('\n')}

Rules:
- Output ONLY the icon identifier with 'icon:' prefix (e.g., "icon:code", "icon:brain")
- Focus on the CONTENT meaning, not the language it's written in
- Choose an icon that best represents the core topic, activity, or subject matter
- For coding/development topics, use: code, terminal, laptop, database
- For AI/intelligence topics, use: brain, bot, sparkles, zap
- For business/work topics, use: briefcase, target, users, trending-up
- For creative topics, use: palette, paintbrush, pen-tool, edit-3
- For education/learning topics, use: book-open, graduation-cap, help-circle
- For entertainment topics, use: music, gamepad-2, video, dices
- No explanations or additional text`,
      role: 'system',
    },
    {
      content: 'I am a copywriting master who helps name design and art works with literary depth',
      role: 'user',
    },
    { content: 'icon:pen-tool', role: 'assistant' },
    {
      content: 'I am a code wizard who converts JavaScript code to TypeScript',
      role: 'user',
    },
    { content: 'icon:code', role: 'assistant' },
    {
      content: 'I am a business plan expert who helps with startup strategies and marketing',
      role: 'user',
    },
    { content: 'icon:rocket', role: 'assistant' },
    {
      content: 'I am an AI assistant that helps with creative writing',
      role: 'user',
    },
    { content: 'icon:sparkles', role: 'assistant' },
    {
      content: 'I help analyze data and create reports',
      role: 'user',
    },
    { content: 'icon:bar-chart-3', role: 'assistant' },
    { content, role: 'user' },
  ],
});
