import type { ReactNode } from 'react'

type IconProps = { size?: number; color?: string }

function Svg({ size = 24, color = 'currentColor', fill = 'none', children }: IconProps & { fill?: string; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill}
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const DropletIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#2563EB'}>
    <path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z" />
  </Svg>
)

export const SunIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#D97706'}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const ThermometerIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#DC2626'}>
    <path d="M14 14.8V4a2 2 0 0 0-4 0v10.8a4 4 0 1 0 4 0z" />
  </Svg>
)

export const SproutIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#15803D'}>
    <path d="M12 21v-9" />
    <path d="M12 12C12 8 9 6 4 6c0 4 2 6 8 6z" />
    <path d="M12 14c0-3 2.5-5 8-5 0 3.5-2.5 5-8 5z" />
  </Svg>
)

export const BugIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#7C3AED'}>
    <ellipse cx="12" cy="14" rx="4.5" ry="6" />
    <path d="M9.5 8.5a2.5 2.5 0 0 1 5 0M12 8v12M7.5 12H4M16.5 12H20M7.7 16.5 5 18.5M16.3 16.5 19 18.5M10 6 8 3.5M14 6l2-2.5" />
  </Svg>
)

export const HeartIcon = (p: IconProps) => (
  <Svg {...p} color={p.color ?? '#BE123C'} fill="#F43F5E">
    <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.3 4.5 6.8 4.5c2 0 3.5 1.1 5.2 3 1.7-1.9 3.2-3 5.2-3 3.5 0 5.8 3.5 4.3 7.2C19.5 16.4 12 21 12 21z" />
  </Svg>
)
