import {
  type SupportedTextSplitterLanguage,
  SupportedTextSplitterLanguages,
} from 'langchain/text_splitter';

import { LANGCHAIN_SUPPORT_TEXT_LIST } from '@/libs/langchain/file';
import { type LangChainLoaderType } from '@/libs/langchain/types';

import { CodeLoader } from './code';
import { CsVLoader } from './csv';
import { DocxLoader } from './docx';
import { EPubLoader } from './epub';
import { LatexLoader } from './latex';
import { MarkdownLoader } from './markdown';
import { PdfLoader } from './pdf';
import { PPTXLoader } from './pptx';
import { TextLoader } from './txt';

class LangChainError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LangChainChunkingError';
  }
}

export class ChunkingLoader {
  partitionContent = async (filename: string, content: Uint8Array) => {
    try {
      const fileBlob = new Blob([Buffer.from(content)]);
      const txt = this.uint8ArrayToString(content);

      const type = this.getType(filename?.toLowerCase());

      switch (type) {
        case 'code': {
          const ext = filename.split('.').pop();
          return await CodeLoader(txt, ext!);
        }

        case 'ppt': {
          return await PPTXLoader(fileBlob);
        }

        case 'latex': {
          return await LatexLoader(txt);
        }

        case 'pdf': {
          return await PdfLoader(fileBlob);
        }

        case 'markdown': {
          return await MarkdownLoader(txt);
        }

        case 'doc': {
          return await DocxLoader(fileBlob);
        }

        case 'text': {
          return await TextLoader(txt);
        }

        case 'csv': {
          return await CsVLoader(fileBlob);
        }

        case 'epub': {
          return await EPubLoader(content);
        }

        default: {
          throw new Error(
            `Unsupported file type [${type}], please check your file is supported, or create report issue here: https://github.com/lobehub/lobe-chat/discussions/3550`,
          );
        }
      }
    } catch (e) {
      throw new LangChainError((e as Error).message);
    }
  };

  private getType = (filename: string): LangChainLoaderType | undefined => {
    if (filename.endsWith('pptx')) {
      return 'ppt';
    }

    // Only .docx is supported, not the old .doc format
    if (filename.endsWith('docx')) {
      return 'doc';
    }

    // Old .doc format (Word 97-2003) is not supported
    if (filename.endsWith('.doc')) {
      throw new Error(
        'Old Word format (.doc) is not supported. Please convert your file to .docx format using Microsoft Word or an online converter.',
      );
    }

    if (filename.endsWith('pdf')) {
      return 'pdf';
    }

    if (filename.endsWith('tex')) {
      return 'latex';
    }

    if (filename.endsWith('md') || filename.endsWith('mdx')) {
      return 'markdown';
    }

    if (filename.endsWith('csv')) {
      return 'csv';
    }

    if (filename.endsWith('epub')) {
      return 'epub';
    }

    const ext = filename.split('.').pop();

    if (ext && SupportedTextSplitterLanguages.includes(ext as SupportedTextSplitterLanguage)) {
      return 'code';
    }

    if (ext && LANGCHAIN_SUPPORT_TEXT_LIST.includes(ext)) return 'text';
  };

  private uint8ArrayToString(uint8Array: Uint8Array) {
    const decoder = new TextDecoder();
    return decoder.decode(uint8Array);
  }
}
