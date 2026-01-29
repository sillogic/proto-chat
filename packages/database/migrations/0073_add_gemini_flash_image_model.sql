-- 添加 Gemini 3 Pro Image 作为图像生成模型
-- 通过 OpenRouter 提供，使用 chat completions API 生成图片（模型ID需要 :image 后缀）

DO $$
DECLARE
  v_alias varchar;
  v_model_id varchar;
BEGIN
  -- 获取 OpenRouter 的 alias
  SELECT alias INTO v_alias FROM protochat_providers WHERE id = 'openrouter' AND enabled = true;

  IF v_alias IS NULL THEN
    RAISE NOTICE 'OpenRouter provider not found or not enabled, skipping image model insertion';
    RETURN;
  END IF;

  -- 删除旧的已下线模型（如果存在）
  DELETE FROM protochat_models
  WHERE original_provider = 'openrouter' AND type = 'image'
    AND original_id LIKE '%gemini-2.5-flash-image-preview%';

  -- 构建 protochat 模型 ID
  -- 注意：:image 后缀告诉 runtime 使用 chat completions API 而不是 images API
  v_model_id := 'protochat::' || v_alias || '::google/gemini-3-pro-image-preview:image';

  INSERT INTO protochat_models (
    id,
    original_id,
    original_provider,
    display_name,
    type,
    enabled,
    context_tokens,
    max_output,
    capabilities,
    parameters
  ) VALUES (
    v_model_id,
    'openrouter::google/gemini-3-pro-image-preview:image',
    'openrouter',
    'Gemini 3 Pro Image',
    'image',
    true,
    32768,
    8192,
    '{"vision": true, "imageOutput": true}'::jsonb,
    '{"prompt": {"default": ""}, "imageUrls": {"default": []}, "aspectRatio": {"default": "1:1", "enum": ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"]}}'::jsonb
  )
  ON CONFLICT (id) DO UPDATE SET
    enabled = true,
    display_name = EXCLUDED.display_name,
    parameters = EXCLUDED.parameters;

  RAISE NOTICE 'Successfully added Gemini 3 Pro Image model: %', v_model_id;
END $$;
