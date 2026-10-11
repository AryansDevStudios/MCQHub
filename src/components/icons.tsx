import React from "react";

export function Logo({ className = "w-6 h-6" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Outer Hexagon / IDE Frame */}
      <polygon points="12 2 21 7 21 17 12 22 3 17 3 7 12 2" />
      {/* Inner Central Hub & Nodes */}
      <circle cx="12" cy="12" r="2.5" fill="currentColor" fillOpacity="0.2" />
      <line x1="12" y1="2" x2="12" y2="7" />
      <line x1="12" y1="17" x2="12" y2="22" />
      <line x1="3" y1="12" x2="7.5" y2="12" />
      <line x1="16.5" y1="12" x2="21" y2="12" />
    </svg>
  );
}
