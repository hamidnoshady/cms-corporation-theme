import { Fragment, type ReactNode } from 'react';
import Link from 'next/link';
import type {
  LinkData,
  Locale,
  Media,
  RichNode,
  RichText as RichTextData,
  SiteDescriptor,
} from '@/lib/cms/types';
import { linkHref } from '@/lib/cms/urls';
import { MediaFigure } from './MediaFigure';
export function plainText(data: RichTextData | undefined): string {
  const read = (node: RichNode, depth: number): string =>
    depth > 20 ? '' : (node.text ?? (node.children ?? []).map((n) => read(n, depth + 1)).join(' '));
  return data?.root ? read(data.root, 0).trim() : '';
}
export function RichText({
  data,
  site,
  locale,
  hero = false,
}: {
  data?: RichTextData;
  site: SiteDescriptor;
  locale: Locale;
  hero?: boolean;
}) {
  if (!data?.root) return null;
  const budget = { remaining: 2000 };
  const heroHeading = hero ? data.root.children?.find((n) => n.type === 'heading') : undefined;
  function render(node: RichNode, depth = 0): ReactNode {
    if (--budget.remaining < 0 || depth > 20) return null;
    const children = node.children?.map((child, i) => (
      <Fragment key={i}>{render(child, depth + 1)}</Fragment>
    ));
    const direction =
      node.direction === 'rtl' || node.direction === 'ltr' ? node.direction : undefined;
    switch (node.type) {
      case 'root':
        return children;
      case 'text': {
        let result: ReactNode = node.text ?? '';
        const format = node.format ?? 0;
        if (format & 1) result = <strong>{result}</strong>;
        if (format & 2) result = <em>{result}</em>;
        if (format & 16) result = <code>{result}</code>;
        if (format & 8) result = <u>{result}</u>;
        if (format & 4) result = <s>{result}</s>;
        return result;
      }
      case 'paragraph':
        return <p dir={direction}>{children}</p>;
      case 'heading': {
        if (node === heroHeading) {
          return (
            <h1 className="t-display-1 whitespace-pre-line" dir={direction}>
              {children}
            </h1>
          );
        }
        const Heading = (node.tag === 'h3' || node.tag === 'h4' ? node.tag : 'h2') as
          | 'h2'
          | 'h3'
          | 'h4';
        return (
          <Heading dir={direction} className={Heading === 'h2' ? 't-h2' : 't-h3'}>
            {children}
          </Heading>
        );
      }
      case 'list':
        return node.listType === 'number' ? (
          <ol dir={direction}>{children}</ol>
        ) : (
          <ul dir={direction}>{children}</ul>
        );
      case 'listitem':
        return <li>{children}</li>;
      case 'quote':
        return <blockquote dir={direction}>{children}</blockquote>;
      case 'linebreak':
        return <br />;
      case 'horizontalrule':
        return <hr />;
      case 'link':
      case 'autolink': {
        const f = node.fields ?? {};
        const href = linkHref(
          {
            type: f.linkType === 'internal' ? 'reference' : 'custom',
            url: typeof f.url === 'string' ? f.url : node.url,
            reference: f.doc as LinkData['reference'],
          },
          site,
          locale,
        );
        return href ? (
          <Link
            href={href}
            target={f.newTab === true ? '_blank' : undefined}
            rel={f.newTab === true ? 'noopener noreferrer' : undefined}
          >
            {children}
          </Link>
        ) : (
          children
        );
      }
      case 'upload':
        return node.relationTo === 'media' ? <MediaFigure media={node.value} /> : null;
      case 'block': {
        if (node.fields?.blockType === 'mediaBlock')
          return <MediaFigure media={node.fields.media as Media} />;
        if (node.fields?.blockType === 'mediaGrid' && Array.isArray(node.fields.images))
          return (
            <div className="grid gap-4 sm:grid-cols-2">
              {node.fields.images.slice(0, 12).map((media, i) => (
                <MediaFigure key={i} media={media as Media} />
              ))}
            </div>
          );
        return null;
      }
      default:
        return children ?? null;
    }
  }
  return (
    <div
      className={`rich-text ${hero ? 'hero-rich' : ''}`}
      dir={
        data.root.direction === 'ltr' || data.root.direction === 'rtl'
          ? data.root.direction
          : locale === 'fa'
            ? 'rtl'
            : 'ltr'
      }
    >
      {render(data.root)}
    </div>
  );
}
