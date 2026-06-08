export type EditorHelperItemBase = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
};

export type KatexHelperItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  syntax: string;
  example: string;
  displayMode?: boolean;
};

export type MermaidHelperItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  template: string;
};

export type MarkdownHelperItem = {
  id: string;
  title: string;
  category: string;
  keywords: string[];
  syntax: string;
  snippet: string;
  example: string;
  action?: 'indent' | 'outdent';
};
