'use client';

import { useImageStore } from '@/store/image';
import { generationBatchSelectors, generationTopicSelectors } from '@/store/image/selectors';

import GenerationFeed from '../GenerationFeed';
import PromptInput from '../PromptInput';
import EmptyState from './EmptyState';
import SkeletonList from './SkeletonList';

const ImageWorkspaceContent = () => {
  const activeTopicId = useImageStore(generationTopicSelectors.activeGenerationTopicId);
  const useFetchGenerationBatches = useImageStore((s) => s.useFetchGenerationBatches);
  const isCurrentGenerationTopicLoaded = useImageStore(
    generationBatchSelectors.isCurrentGenerationTopicLoaded,
  );
  useFetchGenerationBatches(activeTopicId);
  const currentBatches = useImageStore(generationBatchSelectors.currentGenerationBatches);
  const hasGenerations = currentBatches && currentBatches.length > 0;

  if (!isCurrentGenerationTopicLoaded) {
    return <SkeletonList />;
  }

  if (!hasGenerations) return <EmptyState />;

  return (
    <>
      {/* Generation result display area */}
      <GenerationFeed key={activeTopicId} />

      {/* Bottom input area */}
      <PromptInput disableAnimation={true} showTitle={false} />
    </>
  );
};

export default ImageWorkspaceContent;
