import type MarkdownIt from 'markdown-it';

export interface MarkdownItPluginContribution {
  id: string;
  apply(markdown: MarkdownIt): void;
}

export interface MarkdownFenceRenderContext {
  attrs: string;
  content: string;
  info: string;
  lang: string;
}

export interface MarkdownFenceRenderer {
  id: string;
  priority?: number;
  match(ctx: MarkdownFenceRenderContext): boolean;
  render(ctx: MarkdownFenceRenderContext): string;
}

export interface MarkdownMathRenderer {
  renderInline(content: string): string;
  renderBlock(content: string, attrs: string): string;
}

const markdownItPlugins = new Map<string, MarkdownItPluginContribution>();
const fenceRenderers = new Map<string, MarkdownFenceRenderer>();
let mathRenderer: MarkdownMathRenderer | null = null;

export function registerMarkdownItPlugin(plugin: MarkdownItPluginContribution): void {
  markdownItPlugins.set(plugin.id, plugin);
}

export function getMarkdownItPlugins(): MarkdownItPluginContribution[] {
  return Array.from(markdownItPlugins.values());
}

export function registerMarkdownFenceRenderer(renderer: MarkdownFenceRenderer): void {
  fenceRenderers.set(renderer.id, renderer);
}

export function getMarkdownFenceRenderers(): MarkdownFenceRenderer[] {
  return Array.from(fenceRenderers.values()).sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
}

export function setMarkdownMathRenderer(renderer: MarkdownMathRenderer): void {
  mathRenderer = renderer;
}

export function getMarkdownMathRenderer(): MarkdownMathRenderer | null {
  return mathRenderer;
}
