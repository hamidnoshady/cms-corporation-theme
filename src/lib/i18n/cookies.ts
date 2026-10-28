import { cookies } from 'next/headers';
import type { ThemePref } from '@/components/theme/ThemeProvider';
export type { ThemePref } from '@/components/theme/ThemeProvider';
export async function readTheme(fallback: unknown = 'system'): Promise<ThemePref> {
  const value = (await cookies()).get('apex-theme')?.value ?? fallback;
  return value === 'light' || value === 'dark' ? value : 'system';
}
