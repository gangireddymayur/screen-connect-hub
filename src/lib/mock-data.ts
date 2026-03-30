export interface Device {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline' | 'idle';
  resolution: string;
  lastSeen: string;
  playlist: string | null;
  group: string;
  pairingCode: string;
  uptime: number;
}

export interface ContentItem {
  id: string;
  name: string;
  type: 'image' | 'video' | 'text';
  thumbnail: string;
  size: string;
  duration?: string;
  uploadedAt: string;
  usedIn: number;
}

export interface Company {
  id: string;
  name: string;
  plan: 'starter' | 'professional' | 'enterprise';
  screens: number;
  maxScreens: number;
  status: 'active' | 'suspended' | 'trial';
  createdAt: string;
  contactEmail: string;
}

export interface ScheduleEvent {
  id: string;
  screenGroup: string;
  startTime: string;
  endTime: string;
  days: string[];
  priority: 'normal' | 'high' | 'emergency';
}

export const mockDevices: Device[] = [
  { id: 'dev-001', name: 'Lobby Display', location: 'Main Entrance', status: 'online', resolution: '3840x2160', lastSeen: '2 min ago', playlist: 'Welcome Loop', group: 'Lobby', pairingCode: 'AX7K-9P2M', uptime: 99.8 },
  { id: 'dev-002', name: 'Cafeteria Screen', location: 'Floor 2', status: 'online', resolution: '1920x1080', lastSeen: '1 min ago', playlist: 'Menu Board', group: 'Food Court', pairingCode: 'BT3L-7N4Q', uptime: 98.5 },
  { id: 'dev-003', name: 'Conference Room A', location: 'Floor 3', status: 'offline', resolution: '3840x2160', lastSeen: '3 hrs ago', playlist: 'Meeting Info', group: 'Meetings', pairingCode: 'CW8R-2K6J', uptime: 87.2 },
  { id: 'dev-004', name: 'Retail Window', location: 'Storefront', status: 'online', resolution: '1920x1080', lastSeen: 'Just now', playlist: 'Promo Reel', group: 'Retail', pairingCode: 'DY5S-1H8V', uptime: 99.1 },
  { id: 'dev-005', name: 'Elevator Display', location: 'Floor 1', status: 'idle', resolution: '1080x1920', lastSeen: '15 min ago', playlist: null, group: 'Common', pairingCode: 'EZ9T-4M3X', uptime: 95.3 },
  { id: 'dev-006', name: 'Reception TV', location: 'Building B', status: 'online', resolution: '3840x2160', lastSeen: 'Just now', playlist: 'Company News', group: 'Lobby', pairingCode: 'FU2V-6P7W', uptime: 99.9 },
];

export const mockContent: ContentItem[] = [
  { id: 'cnt-001', name: 'Welcome Banner', type: 'image', thumbnail: '', size: '2.4 MB', uploadedAt: '2 days ago', usedIn: 3 },
  { id: 'cnt-002', name: 'Product Demo', type: 'video', thumbnail: '', size: '148 MB', duration: '2:30', uploadedAt: '1 week ago', usedIn: 2 },
  { id: 'cnt-003', name: 'Holiday Promo', type: 'video', thumbnail: '', size: '89 MB', duration: '0:45', uploadedAt: '3 days ago', usedIn: 1 },
  { id: 'cnt-004', name: 'Menu Board', type: 'image', thumbnail: '', size: '1.8 MB', uploadedAt: '5 days ago', usedIn: 1 },
  { id: 'cnt-005', name: 'Breaking News Ticker', type: 'text', thumbnail: '', size: '12 KB', uploadedAt: '1 day ago', usedIn: 4 },
  { id: 'cnt-006', name: 'Brand Guidelines', type: 'image', thumbnail: '', size: '3.1 MB', uploadedAt: '2 weeks ago', usedIn: 2 },
];

export const mockCompanies: Company[] = [
  { id: 'comp-001', name: 'TechCorp Inc.', plan: 'enterprise', screens: 24, maxScreens: 50, status: 'active', createdAt: 'Jan 15, 2024', contactEmail: 'admin@techcorp.com' },
  { id: 'comp-002', name: 'RetailMax', plan: 'professional', screens: 12, maxScreens: 20, status: 'active', createdAt: 'Mar 22, 2024', contactEmail: 'it@retailmax.com' },
  { id: 'comp-003', name: 'FoodChain Co.', plan: 'starter', screens: 3, maxScreens: 5, status: 'trial', createdAt: 'Jun 10, 2024', contactEmail: 'ops@foodchain.co' },
  { id: 'comp-004', name: 'MediaHub', plan: 'professional', screens: 8, maxScreens: 20, status: 'active', createdAt: 'Feb 5, 2024', contactEmail: 'team@mediahub.io' },
  { id: 'comp-005', name: 'CityMall Group', plan: 'enterprise', screens: 45, maxScreens: 100, status: 'active', createdAt: 'Nov 3, 2023', contactEmail: 'digital@citymall.com' },
];

export const mockSchedule: ScheduleEvent[] = [
  { id: 'sch-001', screenGroup: 'Lobby', startTime: '08:00', endTime: '18:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], priority: 'normal' },
  { id: 'sch-002', screenGroup: 'Food Court', startTime: '06:00', endTime: '22:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], priority: 'normal' },
  { id: 'sch-003', screenGroup: 'Retail', startTime: '10:00', endTime: '20:00', days: ['Sat', 'Sun'], priority: 'high' },
  { id: 'sch-004', screenGroup: 'Lobby', startTime: '18:00', endTime: '08:00', days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], priority: 'normal' },
];
