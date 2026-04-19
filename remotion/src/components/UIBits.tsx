import React from "react";
import { C } from "../theme";

export const Card: React.FC<React.PropsWithChildren<{ style?: React.CSSProperties }>> = ({ children, style }) => (
  <div
    style={{
      background: `linear-gradient(160deg, ${C.surface} 0%, ${C.surfaceHi} 100%)`,
      border: `1px solid ${C.border}`,
      borderRadius: 18,
      padding: 28,
      boxShadow: "0 20px 50px -20px rgba(0,0,0,0.6)",
      ...style,
    }}
  >
    {children}
  </div>
);

export const TvIcon: React.FC<{ size?: number; color?: string }> = ({ size = 42, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="2" y="5" width="20" height="13" rx="2.5" stroke={color} strokeWidth="2" />
    <path d="M8 21h8M12 18v3" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const HardDriveIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="14" width="18" height="6" rx="2" stroke={color} strokeWidth="2" />
    <path d="M7 17h.01M11 17h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <path d="M5 14l2-7a2 2 0 012-2h6a2 2 0 012 2l2 7" stroke={color} strokeWidth="2" />
  </svg>
);

export const UsersIcon: React.FC<{ size?: number; color?: string }> = ({ size = 24, color = C.text }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" stroke={color} strokeWidth="2" strokeLinecap="round" />
    <circle cx="9" cy="7" r="4" stroke={color} strokeWidth="2" />
    <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" stroke={color} strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export const Logo: React.FC<{ size?: number }> = ({ size = 56 }) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.25,
      background: `linear-gradient(135deg, ${C.primary} 0%, ${C.primaryGlow} 100%)`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: `0 8px 30px ${C.primary}66`,
    }}
  >
    <TvIcon size={size * 0.55} color="#fff" />
  </div>
);

export const Pill: React.FC<React.PropsWithChildren<{ color?: string; style?: React.CSSProperties }>> = ({
  children,
  color = C.primary,
  style,
}) => (
  <div
    style={{
      display: "inline-flex",
      alignItems: "center",
      gap: 8,
      padding: "8px 16px",
      borderRadius: 999,
      background: `${color}22`,
      color: color,
      border: `1px solid ${color}55`,
      fontSize: 16,
      fontWeight: 600,
      ...style,
    }}
  >
    {children}
  </div>
);
