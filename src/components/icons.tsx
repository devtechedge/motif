import type { ReactNode, SVGProps } from 'react'

function Svg({ children, ...props }: SVGProps<SVGSVGElement> & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  )
}

export const PlayIcon = () => (
  <Svg>
    <path d="M8 5.5v13l11-6.5z" fill="currentColor" stroke="none" />
  </Svg>
)
export const PauseIcon = () => (
  <Svg>
    <path d="M7.5 5.5h3v13h-3zM13.5 5.5h3v13h-3z" fill="currentColor" stroke="none" />
  </Svg>
)
export const StopIcon = () => (
  <Svg>
    <rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor" stroke="none" />
  </Svg>
)
export const VolumeIcon = () => (
  <Svg>
    <path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5H4z" fill="currentColor" stroke="none" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6M18 7a7.4 7.4 0 0 1 0 10" />
  </Svg>
)
export const MutedIcon = () => (
  <Svg>
    <path d="M4 9.5v5h3.5l4.5 3.5v-12L7.5 9.5H4z" fill="currentColor" stroke="none" />
    <path d="M16 9.5l5 5M21 9.5l-5 5" />
  </Svg>
)
export const TimerIcon = () => (
  <Svg>
    <circle cx="12" cy="13.5" r="7.5" />
    <path d="M12 13.5V9.5M9.5 3h5" />
  </Svg>
)
export const SaveIcon = () => (
  <Svg>
    <path d="M7 4h10v16.5l-5-3.8-5 3.8z" />
  </Svg>
)
export const TrashIcon = () => (
  <Svg>
    <path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" />
  </Svg>
)
export const AlertIcon = () => (
  <Svg>
    <path d="M12 3.5 2.5 20h19L12 3.5zM12 9.5V14" />
    <circle cx="12" cy="17" r="0.4" fill="currentColor" />
  </Svg>
)
export const CheckIcon = () => (
  <Svg>
    <path d="M5 13l4.5 4.5L19 7" />
  </Svg>
)
export const AirIcon = () => (
  <Svg>
    <path d="M3 8h9.5a2.3 2.3 0 1 0-2.3-2.3M3 12.5h14a2.3 2.3 0 1 1-2.3 2.3M3 17h7" />
  </Svg>
)
export const WaterIcon = () => (
  <Svg>
    <path d="M12 3.5s5.8 6 5.8 10a5.8 5.8 0 0 1-11.6 0c0-4 5.8-10 5.8-10z" />
  </Svg>
)
export const DroneIcon = () => (
  <Svg>
    <path d="M2 13.5c2.2 0 2.2-5.5 4.6-5.5s3.4 7.5 5.4 7.5 3-7.5 5.4-7.5 2.4 5.5 4.6 5.5" />
  </Svg>
)
export const TextureIcon = () => (
  <Svg strokeWidth={0}>
    <circle cx="7" cy="7.5" r="1.5" fill="currentColor" />
    <circle cx="12" cy="13" r="1.2" fill="currentColor" />
    <circle cx="17" cy="6.5" r="1.4" fill="currentColor" />
    <circle cx="8.5" cy="17" r="1.1" fill="currentColor" />
    <circle cx="16" cy="16.5" r="1" fill="currentColor" />
    <circle cx="12" cy="5" r="0.8" fill="currentColor" />
    <circle cx="19" cy="11" r="0.8" fill="currentColor" />
  </Svg>
)
export const PulseIcon = () => (
  <Svg>
    <path d="M3 12.5h4l2-5.5 3.5 11 2.5-5.5H21" />
  </Svg>
)
export const CloseIcon = () => (
  <Svg>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
)
export const PencilIcon = () => (
  <Svg>
    <path d="M4.5 19.5 5.6 15 16.2 4.4a1.8 1.8 0 0 1 2.6 0l0.8 0.8a1.8 1.8 0 0 1 0 2.6L9 18.4 4.5 19.5zM14.5 6.1l3.4 3.4" />
  </Svg>
)
export const CopyIcon = () => (
  <Svg>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V6a2 2 0 0 1 2-2h9" />
  </Svg>
)
export const DownloadIcon = () => (
  <Svg>
    <path d="M12 4v11M7 10.5 12 15.5l5-5M5 19.5h14" />
  </Svg>
)
export const UploadIcon = () => (
  <Svg>
    <path d="M12 15V4M7 8.5 12 3.5l5 5M5 19.5h14" />
  </Svg>
)
export const LinkIcon = () => (
  <Svg>
    <path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1.5 1.5" />
    <path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6L12.5 17.5" />
  </Svg>
)
export const InfoIcon = () => (
  <Svg>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5" />
    <circle cx="12" cy="8" r="0.4" fill="currentColor" />
  </Svg>
)
export const KeyboardIcon = () => (
  <Svg>
    <rect x="3" y="7" width="18" height="10" rx="2" />
    <path d="M7 11h.01M11 11h.01M15 11h.01M7 14h.01M11 14h6" />
  </Svg>
)

export const LAYER_ICONS = {
  air: AirIcon,
  water: WaterIcon,
  drone: DroneIcon,
  texture: TextureIcon,
  pulse: PulseIcon,
} as const
