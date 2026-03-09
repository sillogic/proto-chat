/**
 * Analyze OpenRouter model modalities and map to model-bank ModelAbilities
 *
 * Usage: node scripts/analyze-openrouter-modalities.mjs
 */

const OPENROUTER_API = 'https://openrouter.ai/api/v1/models';

async function main() {
  console.log('Fetching OpenRouter models...\n');
  const res = await fetch(OPENROUTER_API);
  const { data: models } = await res.json();

  // --- 1. Count distinct modality combinations ---
  const inputCombos = new Map();   // "text,image" -> count
  const outputCombos = new Map();  // "text,image" -> count

  // --- 2. Track which models have each modality ---
  const byInputModality = {};
  const byOutputModality = {};

  // --- 3. Map to proposed ModelAbilities keys ---
  // OpenRouter input -> ModelAbilities field
  const INPUT_TO_ABILITY = {
    image: 'vision',
    file:  'files',
    audio: 'audioInput',  // MISSING in current model-bank
    video: 'video',       // currently mislabeled as "video analysis/generation"
  };
  // OpenRouter output -> ModelAbilities field
  const OUTPUT_TO_ABILITY = {
    image: 'imageOutput',
    audio: 'audioOutput', // MISSING in current model-bank
  };

  const abilityCounts = {};

  for (const model of models) {
    const inputs  = (model.input_modalities  || []).sort().join(',');
    const outputs = (model.output_modalities || []).sort().join(',');

    inputCombos.set(inputs,  (inputCombos.get(inputs)  || 0) + 1);
    outputCombos.set(outputs,(outputCombos.get(outputs)|| 0) + 1);

    for (const m of (model.input_modalities || [])) {
      if (!byInputModality[m]) byInputModality[m] = [];
      byInputModality[m].push(model.id);
    }
    for (const m of (model.output_modalities || [])) {
      if (!byOutputModality[m]) byOutputModality[m] = [];
      byOutputModality[m].push(model.id);
    }

    // Map to ability keys
    for (const [inputMod, abilityKey] of Object.entries(INPUT_TO_ABILITY)) {
      if ((model.input_modalities || []).includes(inputMod)) {
        abilityCounts[abilityKey] = (abilityCounts[abilityKey] || 0) + 1;
      }
    }
    for (const [outputMod, abilityKey] of Object.entries(OUTPUT_TO_ABILITY)) {
      if ((model.output_modalities || []).includes(outputMod)) {
        abilityCounts[abilityKey] = (abilityCounts[abilityKey] || 0) + 1;
      }
    }
  }

  // --- Print results ---

  console.log(`Total models: ${models.length}\n`);

  console.log('=== INPUT modality combinations (sorted by count) ===');
  for (const [combo, count] of [...inputCombos.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  [${count.toString().padStart(4)}]  ${combo || '(none)'}`);
  }

  console.log('\n=== OUTPUT modality combinations (sorted by count) ===');
  for (const [combo, count] of [...outputCombos.entries()].sort((a,b) => b[1]-a[1])) {
    console.log(`  [${count.toString().padStart(4)}]  ${combo || '(none)'}`);
  }

  console.log('\n=== Per-input-modality model count ===');
  for (const [mod, ids] of Object.entries(byInputModality).sort((a,b) => b[1].length - a[1].length)) {
    console.log(`  ${mod.padEnd(8)} ${ids.length} models`);
  }

  console.log('\n=== Per-output-modality model count ===');
  for (const [mod, ids] of Object.entries(byOutputModality).sort((a,b) => b[1].length - a[1].length)) {
    console.log(`  ${mod.padEnd(8)} ${ids.length} models`);
  }

  console.log('\n=== Mapped ModelAbilities key counts ===');
  for (const [key, count] of Object.entries(abilityCounts).sort((a,b) => b[1]-a[1])) {
    const isNew = ['audioInput','audioOutput'].includes(key);
    console.log(`  ${key.padEnd(20)} ${count} models ${isNew ? '<-- NEW, currently missing' : ''}`);
  }

  // --- Sample models for each output modality ---
  console.log('\n=== Sample models with image OUTPUT (imageOutput ability) ===');
  (byOutputModality['image'] || []).slice(0, 10).forEach(id => console.log('  -', id));

  console.log('\n=== Sample models with audio OUTPUT (audioOutput ability) ===');
  (byOutputModality['audio'] || []).slice(0, 10).forEach(id => console.log('  -', id));

  console.log('\n=== Sample models with video INPUT (video ability) ===');
  (byInputModality['video'] || []).slice(0, 10).forEach(id => console.log('  -', id));

  // --- Proposed ability dictionary ---
  console.log('\n' + '='.repeat(60));
  console.log('PROPOSED ModelAbilities redesign:\n');
  console.log(`
// INPUT capabilities (what the model can understand)
vision        boolean  image input recognition     (OpenRouter: input_modalities includes "image")
files         boolean  file upload & reading       (OpenRouter: input_modalities includes "file")
video         boolean  video input understanding   (OpenRouter: input_modalities includes "video")
                       NOTE: rename tooltip to "视觉/视频识别（输入）", remove "生成"
audioInput    boolean  audio input understanding   (OpenRouter: input_modalities includes "audio") -- NEW

// OUTPUT capabilities (what the model can generate)
imageOutput   boolean  image generation            (OpenRouter: output_modalities includes "image")
audioOutput   boolean  audio generation            (OpenRouter: output_modalities includes "audio") -- NEW

// Processing capabilities (behavior, not I/O modality)
functionCall  boolean  tool / function calling
reasoning     boolean  deep thinking / CoT
search        boolean  built-in web search
structuredOutput boolean structured JSON output
  `);

  console.log('\nDatabase location:');
  console.log('  Table:   ai_models');
  console.log('  Column:  abilities  (jsonb, no migration needed for new fields)');
  console.log('  File:    packages/database/src/schemas/aiInfra.ts:74');
  console.log('  Type:    packages/model-bank/src/types/aiModel.ts (ModelAbilities interface)');
}

main().catch(console.error);
