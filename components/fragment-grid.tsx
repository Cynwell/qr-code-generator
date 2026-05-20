// components/fragment-grid.tsx
"use client";
import React from "react";

interface FragmentGridProps {
  totalFragments: number;
  recoveredFlags: boolean[];
}

const FragmentGrid: React.FC<FragmentGridProps> = ({ totalFragments, recoveredFlags }) => {
  if (totalFragments === 0) return null;

  const recoveredCount = recoveredFlags.filter(Boolean).length;
  const percentage = Math.ceil((recoveredCount / totalFragments) * 100);

  return (
    <div className="w-full flex flex-col gap-2">
      <div className="flex justify-between text-sm text-default-500">
        <span>{recoveredCount} / {totalFragments} blocks recovered</span>
        <span>{percentage}%</span>
      </div>
      <div
        className="grid gap-[2px] w-full"
        style={{
          gridTemplateColumns: `repeat(${Math.min(totalFragments, Math.ceil(Math.sqrt(totalFragments * 2)))}, 1fr)`,
        }}
      >
        {Array.from({ length: totalFragments }, (_, i) => (
          <div
            key={i}
            className={`rounded-sm aspect-square min-w-[6px] min-h-[6px] transition-colors ${
              recoveredFlags[i]
                ? "bg-success"
                : "bg-default-200 dark:bg-default-100"
            }`}
            title={`Block ${i + 1}: ${recoveredFlags[i] ? "Recovered" : "Missing"}`}
          />
        ))}
      </div>
    </div>
  );
};

export default FragmentGrid;
