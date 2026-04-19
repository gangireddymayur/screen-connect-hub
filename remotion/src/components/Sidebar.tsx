import React from "react";
import { C } from "../theme";
import { Logo, TvIcon } from "./UIBits";

const items = [
  { label: "Dashboard", active: true },
  { label: "Devices" },
  { label: "Content" },
  { label: "Schedule" },
  { label: "Layouts" },
  { label: "Settings" },
];

export const Sidebar: React.FC<{ active?: string }> = ({ active = "Dashboard" }) => (
  <div
    style={{
      width: 260,
      height: "100%",
      background: C.surface,
      borderRight: `1px solid ${C.border}`,
      padding: 24,
      display: "flex",
      flexDirection: "column",
      gap: 8,
    }}
  >
    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 28 }}>
      <Logo size={40} />
      <div style={{ color: C.text, fontWeight: 700, fontSize: 20 }}>SignageHub</div>
    </div>
    {items.map((it) => {
      const isActive = it.label === active;
      return (
        <div
          key={it.label}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "12px 14px",
            borderRadius: 10,
            background: isActive ? `${C.primary}1f` : "transparent",
            color: isActive ? C.primaryGlow : C.textMuted,
            fontWeight: isActive ? 600 : 500,
            fontSize: 15,
          }}
        >
          <TvIcon size={18} color={isActive ? C.primaryGlow : C.textMuted} />
          {it.label}
        </div>
      );
    })}
  </div>
);
