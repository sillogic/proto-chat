-- 为图像生成模型添加按次计费的定价条目
-- 图像模型不按 token 计费，使用 per_request_price 字段

DO $$
DECLARE
  v_alias varchar;
  v_model_id varchar;
BEGIN
  -- 获取 OpenRouter 的 alias
  SELECT alias INTO v_alias FROM protochat_providers WHERE id = 'openrouter' AND enabled = true;

  IF v_alias IS NULL THEN
    RAISE NOTICE 'OpenRouter provider not found or not enabled, skipping';
    RETURN;
  END IF;

  v_model_id := 'protochat::' || v_alias || '::google/gemini-3-pro-image-preview:image';

  -- 插入定价条目（按次计费）
  -- OpenRouter Gemini 3 Pro Image 大约 $0.039/image
  -- 转换为积分: $0.039 × 500000 = 19500 积分/次
  -- 用户价 = 成本价 × 定价系数（默认1.0）
  INSERT INTO model_pricings (
    id, model, provider, sub_provider,
    input_price, output_price,
    user_input_price, user_output_price,
    per_request_price,
    memo, created_at, updated_at
  ) VALUES (
    'mp_image_gemini3pro',
    v_model_id,
    'protochat',
    'openrouter',
    '0', '0',
    '0', '0',
    '19500',
    'Gemini 3 Pro Image (per-request pricing, ~$0.039/image)',
    NOW(), NOW()
  )
  ON CONFLICT (model, provider, sub_provider) DO UPDATE SET
    per_request_price = '19500',
    memo = EXCLUDED.memo,
    updated_at = NOW();

  RAISE NOTICE 'Successfully added pricing for image model: %', v_model_id;
END $$;
