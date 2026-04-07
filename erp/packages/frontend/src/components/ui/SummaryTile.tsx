import React from 'react';
import { clsx } from 'clsx';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface SummaryTileProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Trend: positive = green arrow up, negative = red arrow down, 0/undefined = neutral */
  trend?: number;
  trendLabel?: string;
  icon?: React.ReactNode;
  color?: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  className?: string;
  onClick?: () => void;
}

const COLOR_MAP = {
  blue: { bg: 'bg-blue-50', icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700' },
  green: { bg: 'bg-green-50', icon: 'bg-green-100 text-green-600', value: 'text-green-700' },
  amber: { bg: 'bg-amber-50', icon: 'bg-amber-100 text-amber-600', value: 'text-amber-700' },
  red: { bg: 'bg-red-50', icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  purple: { bg: 'bg-purple-50', icon: 'bg-purple-100 text-purple-600', value: 'text-purple-700' },
};

export const SummaryTile: React.FC<SummaryTileProps> = ({
  title,
  value,
  subtitle,
  trend,
  trendLabel,
  icon,
  color = 'blue',
  className,
  onClick,
}) => {
  const colors = COLOR_MAP[color];

  const TrendIcon =
    trend === undefined
      ? null
      : trend > 0
      ? TrendingUp
      : trend < 0
      ? TrendingDown
      : Minus;

  const trendColor =
    trend === undefined ? '' : trend > 0 ? 'text-green-600' : trend < 0 ? 'text-red-500' : 'text-gray-400';

  return (
    <div
      className={clsx(
        'bg-white rounded-lg border border-gray-200 p-4 flex items-start gap-3',
        onClick && 'cursor-pointer hover:shadow-md transition-shadow',
        className
      )}
      onClick={onClick}
    >
      {icon && (
        <div className={clsx('p-2.5 rounded-lg shrink-0', colors.icon)}>
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 font-medium uppercase tracking-wide truncate">{title}</p>
        <p className={clsx('text-2xl font-bold mt-0.5', colors.value)}>{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5 truncate">{subtitle}</p>}
        {TrendIcon && trendLabel && (
          <div className={clsx('flex items-center gap-1 mt-1 text-xs', trendColor)}>
            <TrendIcon size={12} />
            <span>{trendLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};
