import { useMemo } from 'react';
import { prepare, layout, type PreparedText } from '@chenglou/pretext';

export interface TextMeasurementOptions {
  font: string;
  lineHeight: number;
  maxWidth: number;
  whiteSpace?: 'normal' | 'pre-wrap';
  padding?: number;
}

export function useTextHeight(
  text: string | null | undefined,
  options: TextMeasurementOptions
): number {
  const { font, lineHeight, maxWidth, whiteSpace = 'normal', padding = 0 } = options;
  
  const prepared: PreparedText | null = useMemo(() => {
    if (!text) return null;
    return prepare(text, font, { whiteSpace });
  }, [text, font, whiteSpace]);
  
  const height = useMemo(() => {
    if (!prepared) return 0;
    const { height } = layout(prepared, maxWidth, lineHeight);
    return height + padding;
  }, [prepared, maxWidth, lineHeight, padding]);
  
  return height;
}
