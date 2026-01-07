/**
 * Type declarations for modules without TypeScript definitions
 */

// Toast UI React Image Editor
declare module '@toast-ui/react-image-editor' {
  import { Component } from 'react';

  interface ImageEditorProps {
    includeUI?: {
      loadImage?: {
        path: string;
        name: string;
      };
      theme?: Record<string, unknown>;
      menu?: string[];
      initMenu?: string;
      uiSize?: {
        width: string;
        height: string;
      };
      menuBarPosition?: string;
    };
    cssMaxHeight?: number;
    cssMaxWidth?: number;
    selectionStyle?: {
      cornerSize?: number;
      rotatingPointOffset?: number;
    };
    usageStatistics?: boolean;
  }

  export default class ImageEditor extends Component<ImageEditorProps> {
    getInstance(): {
      toDataURL(options?: { format?: string; quality?: number }): string;
      loadImageFromURL(url: string, name: string): Promise<void>;
      clearUndoStack(): void;
      clearRedoStack(): void;
    };
  }
}

// File Saver
declare module 'file-saver' {
  export function saveAs(data: Blob | string, filename?: string, options?: { autoBom?: boolean }): void;
}
