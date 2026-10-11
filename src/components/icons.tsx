import React from "react";

export function Logo({ className = "w-6 h-6", alt = "MCQHub Logo" }: { className?: string; alt?: string }) {
  return (
    <img
      src="/logo.png"
      alt={alt}
      className={`${className} object-cover rounded-md select-none`}
      loading="eager"
    />
  );
}
