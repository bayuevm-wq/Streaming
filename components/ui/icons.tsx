import type { ReactNode, SVGProps } from "react";

// Set ikon Streaming: garis 1,8px berujung persegi (sejalan dengan sudut tajam), satu keluarga.
// Ikon dekoratif tidak diumumkan (aria-hidden). Beri `title` hanya bila ikon berdiri sendiri dan bermakna.
type IconProps = Omit<SVGProps<SVGSVGElement>, "children"> & { title?: string };

function Svg({ title, children, className, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="1em"
      height="1em"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="square"
      strokeLinejoin="miter"
      focusable="false"
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
      className={className}
      {...rest}
    >
      {children}
    </svg>
  );
}

const solid = { fill: "currentColor", stroke: "none" } as const;

export const IconPlay = (p: IconProps) => (
  <Svg {...p} {...solid}>
    <path d="M7 4.5v15l13-7.5z" />
  </Svg>
);
export const IconPause = (p: IconProps) => (
  <Svg {...p} {...solid}>
    <rect x="6" y="4.5" width="4" height="15" />
    <rect x="14" y="4.5" width="4" height="15" />
  </Svg>
);
export const IconPrev = (p: IconProps) => (
  <Svg {...p} {...solid}>
    <rect x="5" y="5" width="2.5" height="14" />
    <path d="M19 5v14L9 12z" />
  </Svg>
);
export const IconNext = (p: IconProps) => (
  <Svg {...p} {...solid}>
    <rect x="16.5" y="5" width="2.5" height="14" />
    <path d="M5 5v14l10-7z" />
  </Svg>
);
export function IconHeart({ filled, ...p }: IconProps & { filled?: boolean }) {
  return (
    <Svg {...p} fill={filled ? "currentColor" : "none"}>
      <path d="M12 20.5 4.2 12.6A4.6 4.6 0 0 1 11 6.4l1 1 1-1a4.6 4.6 0 0 1 6.8 6.2z" />
    </Svg>
  );
}
export const IconVolume = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9.5v5h3.5L12 18V6L7.5 9.5z" fill="currentColor" />
    <path d="M15.5 9a4.2 4.2 0 0 1 0 6" />
  </Svg>
);
export const IconQueue = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h11M4 12h11M4 17h6" />
    <path d="M18 12.5v6l4-3z" fill="currentColor" />
  </Svg>
);
export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="10.5" cy="10.5" r="6" />
    <path d="m15 15 5 5" />
  </Svg>
);
export const IconHome = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 11 12 4l8 7v9h-5.5v-6h-5v6H4z" />
  </Svg>
);
export const IconLibrary = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 4v16M10 4v16" />
    <path d="m14.5 5.5 4.6-1.4 1.4 14.4-4.6 1.4z" />
  </Svg>
);
export const IconPlaylist = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h12M4 12h12M4 17h7" />
    <path d="M19 6v9.5" />
    <circle cx="17" cy="16" r="2" fill="currentColor" />
  </Svg>
);
export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);
export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="m6 6 12 12M18 6 6 18" />
  </Svg>
);
export const IconMusic = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 17V5l10-2v12" />
    <circle cx="7" cy="17" r="2.5" fill="currentColor" />
    <circle cx="17" cy="15" r="2.5" fill="currentColor" />
  </Svg>
);

// Ikon status: bentuk BERBEDA (lingkaran, segitiga, segi delapan) agar tak bergantung pada warna saja.
export const IconSuccess = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="m7.8 12.3 3 3 5.4-6.1" />
  </Svg>
);
export const IconWarning = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3.5 22 20H2z" />
    <path d="M12 10v4.5M12 17v.5" />
  </Svg>
);
export const IconError = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8.5 3h7L21 8.5v7L15.5 21h-7L3 15.5v-7z" />
    <path d="m9 9 6 6M15 9l-6 6" />
  </Svg>
);

export const ICONS = {
  play: IconPlay,
  pause: IconPause,
  prev: IconPrev,
  next: IconNext,
  heart: IconHeart,
  volume: IconVolume,
  queue: IconQueue,
  search: IconSearch,
  home: IconHome,
  library: IconLibrary,
  playlist: IconPlaylist,
  plus: IconPlus,
  close: IconClose,
  music: IconMusic,
  success: IconSuccess,
  warning: IconWarning,
  error: IconError,
} as const;
