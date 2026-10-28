import type { MetadataRoute } from 'next';
import { deploymentIsPreview, siteOrigin } from '@/lib/cms/client';
export const dynamic = 'force-dynamic';
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        ...(deploymentIsPreview()
          ? { disallow: '/' }
          : { allow: '/', disallow: ['/api/', '/next/'] }),
      },
    ],
    sitemap: `${siteOrigin()}/sitemap.xml`,
  };
}
