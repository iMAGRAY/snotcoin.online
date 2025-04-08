"use client"

import React from "react"

export interface StatInfoProps {
  label: string;
  value: string;
  tooltip: string;
}

const StatInfo: React.FC<StatInfoProps> = ({ 
  label, 
  value, 
  tooltip 
}) => (
  <div className="flex flex-col items-center px-2">
    <div className="text-sm text-gray-300">{label}</div>
    <div className="font-bold text-white">{value}</div>
  </div>
);

export default StatInfo; 