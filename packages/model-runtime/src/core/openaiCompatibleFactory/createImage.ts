import { imageUrlToBase64 } from '@lobechat/utils';
import { cleanObject } from '@lobechat/utils/object';
import createDebug from 'debug';
import type { RuntimeImageGenParamsValue } from 'model-bank';
import type OpenAI from 'openai';

import type { CreateImagePayload, CreateImageResponse } from '../../types/image';
import { getModelPricing } from '../../utils/getModelPricing';
import { convertImageUrlToFile } from '../contextBuilders/openai';
import { convertOpenAIImageUsage } from '../usageConverters/openai';

const log = createDebug('lobe-image:openai-compatible');

/**
 * Generate images using traditional OpenAI images API (DALL-E, etc.)
 */
async function generateByImageMode(
  client: OpenAI,
  payload: CreateImagePayload,
  provider: string,
): Promise<CreateImageResponse> {
  const { model, params } = payload;

  log('Creating image with model: %s and params: %O', model, params);

  // Map parameter names, mapping imageUrls to image
  const paramsMap = new Map<RuntimeImageGenParamsValue, string>([
    ['imageUrls', 'image'],
    ['imageUrl', 'image'],
  ]);
  const userInput: Record<string, any> = Object.fromEntries(
    Object.entries(params).map(([key, value]) => [
      paramsMap.get(key as RuntimeImageGenParamsValue) ?? key,
      value,
    ]),
  );
  // unify image input to array
  if (typeof userInput.image === 'string' && userInput.image.trim() !== '') {
    userInput.image = [userInput.image];
  }

  // https://platform.openai.com/docs/api-reference/images/createEdit
  const isImageEdit = Array.isArray(userInput.image) && userInput.image.length > 0;
  log('isImageEdit: %O, userInput.image: %O', isImageEdit, userInput.image);
  // If there are imageUrls parameters, convert them to File objects
  if (isImageEdit) {
    try {
      // Convert all image URLs to File objects
      const imageFiles = await Promise.all(
        userInput.image.map((url: string) => convertImageUrlToFile(url)),
      );

      // According to official docs, if there are multiple images, pass an array; if only one, pass a single File
      userInput.image = imageFiles.length === 1 ? imageFiles[0] : imageFiles;
    } catch (error) {
      throw new Error(`Failed to convert image URLs to File objects: ${error}`);
    }
  } else {
    delete userInput.image;
  }

  if (userInput.size === 'auto') {
    delete userInput.size;
  }

  const defaultInput = {
    n: 1,
    ...(model.includes('dall-e') ? { response_format: 'b64_json' } : {}),
    // https://platform.openai.com/docs/api-reference/images/createEdit#images_createedit-input_fidelity
    ...(isImageEdit && model.includes('gpt-image-') && !model.includes('mini')
      ? { input_fidelity: 'high' }
      : {}),
  };

  const options = cleanObject({
    model,
    ...defaultInput,
    ...userInput,
  });

  log('options: %O', options);

  // Determine if it's an image editing operation
  const img = isImageEdit
    ? await client.images.edit(options as any)
    : await client.images.generate(options as any);

  // Check the integrity of response data
  if (!img || !img.data || !Array.isArray(img.data) || img.data.length === 0) {
    throw new Error('Invalid image response: missing or empty data array');
  }

  const imageData = img.data[0];
  if (!imageData) {
    throw new Error('Invalid image response: first data item is null or undefined');
  }

  let imageUrl: string;

  // Handle base64 format response
  if (imageData.b64_json) {
    // Determine the image's MIME type, default to PNG
    const mimeType = 'image/png'; // OpenAI image generation defaults to PNG format

    // Convert base64 string to complete data URL
    imageUrl = `data:${mimeType};base64,${imageData.b64_json}`;
    log('Successfully converted base64 to data URL, length: %d', imageUrl.length);
  }
  // Handle URL format response
  else if (imageData.url) {
    imageUrl = imageData.url;
    log('Using direct image URL: %s', imageUrl);
  }
  // If neither format exists, throw error
  else {
    throw new Error('Invalid image response: missing both b64_json and url fields');
  }

  return {
    imageUrl,
    ...(img.usage
      ? {
          modelUsage: convertOpenAIImageUsage(img.usage, await getModelPricing(model, provider)),
        }
      : {}),
  };
}

/**
 * Process image URL for chat model input
 */
async function processImageUrlForChat(imageUrl: string): Promise<string> {
  // Fast-path for data URIs: avoid regex on potentially huge base64 strings
  // (regex `.+$` on megabyte-length strings can overflow the V8 call stack)
  if (imageUrl.startsWith('data:')) {
    const commaIndex = imageUrl.indexOf(',');
    if (commaIndex === -1 || !imageUrl.slice(0, commaIndex).includes(';base64')) {
      throw new TypeError('Image data URI is not in base64 format');
    }
    // Already a valid base64 data URL — return as-is
    return imageUrl;
  }

  // For regular URLs, convert to base64 via HTTP fetch
  try {
    new URL(imageUrl);
  } catch {
    throw new TypeError(`Currently we don't support image url: ${imageUrl}`);
  }
  const { base64: urlBase64, mimeType: urlMimeType } = await imageUrlToBase64(imageUrl);
  return `data:${urlMimeType};base64,${urlBase64}`;
}

/**
 * Generate images using chat completion API (OpenRouter Gemini, etc.)
 */
async function generateByChatModel(
  client: OpenAI,
  payload: CreateImagePayload,
): Promise<CreateImageResponse> {
  const { model, params } = payload;
  const actualModel = model.replace(':image', ''); // Remove :image suffix

  log('Creating image via chat API with model: %s and params: %O', actualModel, params);

  // Build message content array
  const content: Array<any> = [
    {
      text: params.prompt,
      type: 'text',
    },
  ];

  // Add reference images (supports both single imageUrl and imageUrls array)
  const imageUrlList = [
    ...(params.imageUrl ? [params.imageUrl] : []),
    ...(Array.isArray(params.imageUrls) ? params.imageUrls : []),
  ].filter(Boolean);

  if (imageUrlList.length > 0) {
    log('Processing %d reference image(s) for chat input', imageUrlList.length);
    try {
      const processedUrls = await Promise.all(imageUrlList.map(processImageUrlForChat));
      for (const processedImageUrl of processedUrls) {
        content.push({ image_url: { url: processedImageUrl }, type: 'image_url' });
      }
      log('Successfully processed reference images for chat input');
    } catch (error) {
      throw new Error(`Failed to process reference image URL: ${error}`);
    }
  }

  // Build image_config for OpenRouter-style image generation
  // https://openrouter.ai/docs/guides/overview/multimodal/image-generation
  const imageConfig: Record<string, string> = {};
  if (params.aspectRatio) imageConfig.aspect_ratio = params.aspectRatio;
  if (params.resolution) imageConfig.image_size = params.resolution;

  // Call chat completion API
  const response = await client.chat.completions.create({
    messages: [
      {
        content,
        role: 'user',
      },
    ],
    model: actualModel,
    modalities: ['image', 'text'],
    ...(Object.keys(imageConfig).length > 0 ? { image_config: imageConfig } : {}),
    stream: false,
  } as any);

  log('Chat API response: %O', response);

  // Extract image from response
  const message = response.choices[0]?.message;
  if (!message) {
    throw new Error('No message in chat completion response');
  }

  // Check if response has images in the expected format
  if ((message as any).images && Array.isArray((message as any).images)) {
    const { images } = message as any;
    if (images.length > 0) {
      const image = images[0];
      if (image.image_url?.url) {
        log('Successfully extracted image from chat response');
        return { imageUrl: image.image_url.url };
      }
    }
  }

  // If no images found, throw error
  throw new Error('No image generated in chat completion response');
}

/**
 * Create image using OpenAI Compatible API
 */
export async function createOpenAICompatibleImage(
  client: OpenAI,
  payload: CreateImagePayload,
  provider: string,
): Promise<CreateImageResponse> {
  const { model } = payload;

  // Check if it's a chat model for image generation (via :image suffix)
  if (model.endsWith(':image')) {
    return await generateByChatModel(client, payload);
  }

  // Default to traditional images API
  return await generateByImageMode(client, payload, provider);
}
