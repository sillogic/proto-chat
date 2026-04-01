'use client';

import { useQueryState } from '@/hooks/useQueryParam';
import { useImageStore } from '@/store/image';

import Content from './Content';
import EmptyState from './EmptyState';

const ImageWorkspace = () => {
  const [topic] = useQueryState('topic');
  const isCreatingWithNewTopic = useImageStore((s) => s.isCreatingWithNewTopic);

  // If there is no topic parameter, or a new topic image is being created, show the empty state layout
  if (!topic || isCreatingWithNewTopic) {
    return <EmptyState />;
  }

  // When a topic parameter exists and not in the creating new topic state, show the main content
  return <Content />;
};

export default ImageWorkspace;
