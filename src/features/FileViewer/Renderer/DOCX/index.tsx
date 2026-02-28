import type { DocRenderer } from '@cyntler/react-doc-viewer';
import { Center, Flexbox } from '@lobehub/ui';
import { createStyles } from 'antd-style';
import { useEffect, useState } from 'react';

import CircleLoading from '@/components/Loading/CircleLoading';

const useStyles = createStyles(({ css, token }) => ({
  container: css`
    overflow: auto;

    width: 100%;
    height: 100%;
    padding: 24px;

    background: ${token.colorBgContainer};
  `,
  content: css`
    max-width: 800px;
    margin-block: 0;
    margin-inline: auto;

    /* Mammoth-generated HTML styling */
    p {
      margin-block-end: 1em;
      line-height: 1.6;
    }

    h1, h2, h3, h4, h5, h6 {
      margin-block: 1.5em 0.5em;
      font-weight: 600;
    }

    ul, ol {
      margin-block-end: 1em;
      padding-inline-start: 2em;
    }

    table {
      border-collapse: collapse;
      width: 100%;
      margin-block-end: 1em;
    }

    td, th {
      padding: 8px;
      border: 1px solid ${token.colorBorder};
    }

    th {
      font-weight: 600;
      background: ${token.colorBgTextHover};
    }

    img {
      max-width: 100%;
      height: auto;
    }
  `,
  error: css`
    color: ${token.colorError};
    text-align: center;
  `,
}));

const DOCXRenderer: DocRenderer = ({ mainState: { currentDocument } }) => {
  const { styles } = useStyles();
  const [html, setHtml] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const convertDocx = async () => {
      if (!currentDocument?.uri) {
        setError('No document URI provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch the .docx file
        const response = await fetch(currentDocument.uri);
        if (!response.ok) {
          throw new Error(`Failed to fetch document: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();

        // Import mammoth dynamically to reduce bundle size
        const mammoth = await import('mammoth');

        // Convert .docx to HTML
        const result = await mammoth.convertToHtml(
          { arrayBuffer },
          {
            // Options for better HTML output
            styleMap: [
              "p[style-name='Heading 1'] => h1:fresh",
              "p[style-name='Heading 2'] => h2:fresh",
              "p[style-name='Heading 3'] => h3:fresh",
              "p[style-name='Heading 4'] => h4:fresh",
              "p[style-name='Heading 5'] => h5:fresh",
              "p[style-name='Heading 6'] => h6:fresh",
            ],
          },
        );

        if (result.messages.length > 0) {
          console.warn('Mammoth conversion warnings:', result.messages);
        }

        setHtml(result.value);
      } catch (err) {
        console.error('Error converting DOCX:', err);
        setError(err instanceof Error ? err.message : 'Failed to convert document');
      } finally {
        setLoading(false);
      }
    };

    convertDocx();
  }, [currentDocument?.uri]);

  if (loading) {
    return (
      <Center height={'100%'} width={'100%'}>
        <CircleLoading />
      </Center>
    );
  }

  if (error) {
    return (
      <Center height={'100%'} width={'100%'}>
        <Flexbox className={styles.error} gap={12}>
          <div>Failed to load document</div>
          <div>{error}</div>
        </Flexbox>
      </Center>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.content} dangerouslySetInnerHTML={{ __html: html || '' }} />
    </div>
  );
};

export default DOCXRenderer;

DOCXRenderer.fileTypes = [
  'docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
DOCXRenderer.weight = 1; // Higher weight than MSDoc to take precedence
DOCXRenderer.fileLoader = ({ fileLoaderComplete }) => fileLoaderComplete();
