export type ZoneSplit = 'none' | 'horizontal' | 'vertical';

export type TextAnimation = 'none' | 'scroll-left' | 'scroll-right' | 'scroll-up' | 'scroll-down' | 'typewriter' | 'fade' | 'blink';

export type ContentWidgetType = 'image' | 'video' | 'text' | 'clock' | 'weather' | 'rss' | 'empty';

export interface ContentWidget {
  id: string;
  type: ContentWidgetType;
  label: string;
  // text props
  text?: string;
  fontSize?: number;
  fontWeight?: string;
  textColor?: string;
  textAnimation?: TextAnimation;
  scrollSpeed?: 'slow' | 'normal' | 'fast';
  // media props
  mediaUrl?: string;
  mediaName?: string;
  objectFit?: 'cover' | 'contain' | 'fill';
  // styling
  backgroundColor?: string;
  padding?: number;
  borderRadius?: number;
  opacity?: number;
}

export interface ScreenZone {
  id: string;
  split: ZoneSplit;
  /** 0-100, how much first child takes */
  splitRatio: number;
  content: ContentWidget | null;
  children: [ScreenZone, ScreenZone] | null;
}

export interface ScreenLayout {
  id: string;
  name: string;
  deviceId: string;
  resolution: { width: number; height: number };
  backgroundColor: string;
  rootZone: ScreenZone;
}

export function createZone(id?: string): ScreenZone {
  return {
    id: id || `zone-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    split: 'none',
    splitRatio: 50,
    content: null,
    children: null,
  };
}

export function createWidget(type: ContentWidgetType): ContentWidget {
  const id = `widget-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const base: ContentWidget = {
    id,
    type,
    label: type.charAt(0).toUpperCase() + type.slice(1),
    backgroundColor: 'transparent',
    padding: 8,
    borderRadius: 0,
    opacity: 100,
  };

  switch (type) {
    case 'text':
      return {
        ...base,
        text: 'Your text here',
        fontSize: 24,
        fontWeight: '600',
        textColor: '#ffffff',
        textAnimation: 'none',
        scrollSpeed: 'normal',
      };
    case 'clock':
      return {
        ...base,
        label: 'Clock',
        fontSize: 48,
        textColor: '#ffffff',
        fontWeight: '700',
      };
    case 'weather':
      return { ...base, label: 'Weather Widget', text: '22°C Sunny' };
    case 'rss':
      return { ...base, label: 'RSS Feed', text: 'Breaking: News headline scrolling...', textAnimation: 'scroll-left', scrollSpeed: 'normal' };
    case 'image':
      return { ...base, objectFit: 'cover' };
    case 'video':
      return { ...base, objectFit: 'contain' };
    default:
      return base;
  }
}

export function splitZone(zone: ScreenZone, direction: ZoneSplit): ScreenZone {
  if (direction === 'none') return zone;
  return {
    ...zone,
    split: direction,
    splitRatio: 50,
    content: null,
    children: [
      { ...createZone(), content: zone.content },
      createZone(),
    ],
  };
}

export function createDefaultLayout(deviceId: string, name: string): ScreenLayout {
  return {
    id: `layout-${Date.now()}`,
    name,
    deviceId,
    resolution: { width: 1920, height: 1080 },
    backgroundColor: '#1a1a2e',
    rootZone: createZone('root'),
  };
}
