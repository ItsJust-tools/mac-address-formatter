import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import manifest from '@/app/manifest';
import robots from '@/app/robots';
import sitemap from '@/app/sitemap';
import ErrorPage from '@/app/error';
import NotFound from '@/app/not-found';
import { JsonLd } from '@/app/json-ld';
import ToolPage from '@/app/page';
import { cn } from '@/lib/utils';
import { generateJsonLd, generateToolMetadata } from '@/lib/seo';
import { toolConfig } from '@/tool/tool.config';
import { getPublicSiteUrl, templateMetadata } from '@/tool/template-metadata';
import { macAddressFormatterTool } from '@/tool/tool-definition';
import { Canvas } from '@/tool/components/Canvas';
import { Sidebar } from '@/tool/components/Sidebar';
import { Toolbar } from '@/tool/components/Toolbar';
import { DEFAULT_STATE as BASE_DEFAULT_STATE } from '@/tool/types';
import type { ExporterLoader } from '@itsjust/core';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('@/app/tool-client-wrapper', () => ({
  default: () => <div data-testid="tool-client-wrapper">tool-client-wrapper</div>,
}));

describe('app and seo', () => {
  const getOgImageUrl = (
    images: NonNullable<NonNullable<ReturnType<typeof generateToolMetadata>['openGraph']>['images']>
  ): string | undefined => {
    const list = Array.isArray(images) ? images : [images];
    const first = list[0];
    if (!first) return undefined;
    if (typeof first === 'string') return first;
    if (first instanceof URL) return first.toString();
    return String(first.url);
  };

  it('builds metadata and json-ld values', () => {
    const metadata = generateToolMetadata(toolConfig);
    const jsonLd = generateJsonLd(toolConfig);

    expect(metadata.creator).toBe(toolConfig.name);
    expect(metadata.metadataBase?.toString()).toBe('http://localhost:3000/');
    const ogUrl = metadata.openGraph?.images ? getOgImageUrl(metadata.openGraph.images) : undefined;
    expect(ogUrl).toContain('/og.svg');
    expect(jsonLd.url).toBe('http://localhost:3000');
    expect(jsonLd.featureList.length).toBeGreaterThan(0);
  });

  it('returns site manifest, robots and sitemap', () => {
    const man = manifest();
    const rob = robots();
    const sm = sitemap();
    expect(man.name).toBe(toolConfig.name);
    expect(Array.isArray(rob.rules) && rob.rules.length).toBeGreaterThan(0);
    expect(Array.isArray(sm)).toBe(true);
  });

  it('exposes template metadata and site url', () => {
    expect(templateMetadata.appName).toBe(toolConfig.name);
    expect(getPublicSiteUrl()).toBeTypeOf('string');
  });

  it('renders error and not-found pages', () => {
    render(<ErrorPage error={new Error('boom')} reset={() => {}} />);
    expect(document.querySelector('.error-page')).not.toBeNull();
    render(<NotFound />);
    expect(document.querySelectorAll('.error-page').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Go home').length).toBeGreaterThan(0);
  });

  it('renders the json-ld script and landing page', () => {
    render(<JsonLd config={toolConfig} />);
    expect(document.querySelector('script[type="application/ld+json"]')).not.toBeNull();
    render(<ToolPage />);
    expect(screen.getByTestId('tool-client-wrapper')).toBeInTheDocument();
  });

  it('joins class names with cn', () => {
    expect(cn('a', false && 'b', 'c')).toBe('a c');
  });

  it('deserializes valid and invalid tool state', () => {
    const ok = macAddressFormatterTool.deserialize({
      input: 'AA:BB:CC:DD:EE:FF',
      casing: 'lower',
      history: [],
    });
    expect(ok.success).toBe(true);
    if (ok.success) expect(ok.data.casing).toBe('lower');

    const repaired = macAddressFormatterTool.deserialize({ nope: true });
    expect(repaired.success).toBe(true);
    if (repaired.success) {
      expect(repaired.data.casing).toBe(BASE_DEFAULT_STATE.casing);
    }
    expect(macAddressFormatterTool.name).toBe(toolConfig.name);
  });

  it('serializes state and registers exporters', () => {
    const serialized = macAddressFormatterTool.serialize(BASE_DEFAULT_STATE);
    expect(() => JSON.parse(serialized)).not.toThrow();
    const exporters =
      (
        macAddressFormatterTool as {
          exporters?: Array<{ loader: ExporterLoader }>;
        }
      ).exporters ?? [];
    expect(exporters.length).toBeGreaterThan(0);
  });

  it('renders the canvas, sidebar and toolbar', () => {
    render(
      <Canvas state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} onSaveHistory={() => {}} />
    );
    expect(screen.getByTestId('mac-canvas')).toBeInTheDocument();
    expect(screen.getByTestId('input-mac')).toBeInTheDocument();
  });

  it('renders sidebar and toolbar', () => {
    render(<Sidebar state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} />);
    expect(screen.getByTestId('mac-sidebar')).toBeInTheDocument();
    render(<Toolbar state={{ ...BASE_DEFAULT_STATE }} onChange={() => {}} onClear={() => {}} />);
    expect(screen.getByTestId('btn-clear')).toBeInTheDocument();
  });
});
