"use client";
import React from 'react';

type SparklineProps = {
  values: number[];
  width?: number;
  height?: number;
  stroke?: string;
  fill?: string;
};

export function Sparkline({
  values,
  width = 240,
  height = 48,
  stroke = '#2a6dff',
  fill = 'rgba(42,109,255,0.15)',
}: SparklineProps) {
  if (values.length === 0) return null;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const dx = width / (values.length - 1 || 1);
  const normalize = (v: number) =>
    height - ((v - min) / (max - min || 1)) * (height - 4) - 2;
  const points = values.map((v, i) => `${i * dx},${normalize(v)}`).join(' ');
  const area = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      <polyline points={area} fill={fill} stroke="none" />
      <polyline points={points} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
