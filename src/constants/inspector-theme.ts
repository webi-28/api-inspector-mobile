import { useColorScheme } from '@/hooks/use-color-scheme';

const palettes = {
  dark: {
    background: '#0B0E14',
    surface: '#131823',
    elevated: '#1A2130',
    border: '#283244',
    text: '#F3F6FB',
    muted: '#9AA8BC',
    accent: '#63E6BE',
    accentSurface: '#16352F',
    blue: '#8AB4F8',
    danger: '#FF7582',
    warning: '#F2C879',
  },
  light: {
    background: '#F4F6F9',
    surface: '#FFFFFF',
    elevated: '#EEF2F7',
    border: '#D9E0EA',
    text: '#17202D',
    muted: '#617084',
    accent: '#087F68',
    accentSurface: '#DDF5EE',
    blue: '#2866B4',
    danger: '#C43848',
    warning: '#966407',
  },
} as const;

export type InspectorPalette = (typeof palettes)[keyof typeof palettes];

export function useInspectorTheme(): InspectorPalette {
  const colorScheme = useColorScheme();
  return palettes[colorScheme === 'dark' ? 'dark' : 'light'];
}
