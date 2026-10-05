type P = { size?: number };

export const ShieldIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3z" fill="#c9452f" stroke="#ffd27a" strokeWidth="1.5" />
    <path d="M12 6v12M7 11h10" stroke="#ffe7b0" strokeWidth="1.6" />
  </svg>
);

export const WoodIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="3" y="8" width="18" height="9" rx="4.5" transform="rotate(-30 12 12)" fill="#b8742f" stroke="#6b3b14" strokeWidth="1.4" />
    <ellipse cx="17.2" cy="8.8" rx="2.4" ry="3.6" transform="rotate(-30 17 9)" fill="#e7b678" stroke="#6b3b14" strokeWidth="1.2" />
  </svg>
);

export const CoinIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9.5" fill="#f5c542" stroke="#a87b12" strokeWidth="1.8" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="#d9a520" strokeWidth="1.2" />
    <text x="12" y="16" textAnchor="middle" fontSize="10" fontWeight="900" fill="#8a6208">$</text>
  </svg>
);

export const GemIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M6 4h12l4 6-10 11L2 10z" fill="#5fc9ff" stroke="#1b6fb3" strokeWidth="1.4" />
    <path d="M2 10h20M8 4l4 17 4-17" stroke="#c9f0ff" strokeWidth="1" fill="none" />
  </svg>
);

export const SkullIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2C6.5 2 3 5.8 3 10.5c0 3 1.5 5 3.5 6V20h11v-3.5c2-1 3.5-3 3.5-6C21 5.8 17.5 2 12 2z" fill="#f2efe6" stroke="#2a2a2a" strokeWidth="1.4" />
    <circle cx="8.5" cy="11" r="2.4" fill="#2a2a2a" />
    <circle cx="15.5" cy="11" r="2.4" fill="#2a2a2a" />
    <path d="M10 20v-2.5M12 20v-2.5M14 20v-2.5" stroke="#2a2a2a" strokeWidth="1.2" />
  </svg>
);

export const GasMaskIcon = ({ size = 34 }: P) => (
  <svg width={size} height={size} viewBox="0 0 40 40">
    <circle cx="20" cy="17" r="12" fill="#596068" />
    <circle cx="14.5" cy="15" r="4.2" fill="#aee3f0" stroke="#1d2125" strokeWidth="2" />
    <circle cx="25.5" cy="15" r="4.2" fill="#aee3f0" stroke="#1d2125" strokeWidth="2" />
    <rect x="15.5" y="22" width="9" height="9" rx="3" fill="#2b3036" />
    <circle cx="20" cy="33" r="4.5" fill="#3e444b" stroke="#1d2125" strokeWidth="1.5" />
  </svg>
);

export const PauseIcon = ({ size = 18 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="6" y="5" width="4" height="14" rx="1" fill="#fff" />
    <rect x="14" y="5" width="4" height="14" rx="1" fill="#fff" />
  </svg>
);

export const HammerIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 7l5-4 4 3-2 2 9 9-2 2-9-9-2 2z" fill="#d6d9de" stroke="#3b3f45" strokeWidth="1.2" />
  </svg>
);

export const RocketIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M12 2c3 2 5 6 5 10l-2 5H9l-2-5c0-4 2-8 5-10z" fill="#d6d9de" stroke="#3b3f45" strokeWidth="1.2" />
    <circle cx="12" cy="10" r="2" fill="#5fc9ff" />
    <path d="M10 18l2 4 2-4" fill="#ff8a3d" />
  </svg>
);

export const MailIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <rect x="3" y="6" width="18" height="13" rx="2" fill="#f1e6c8" stroke="#3b3f45" strokeWidth="1.2" />
    <path d="M3 7l9 7 9-7" stroke="#3b3f45" strokeWidth="1.2" fill="none" />
  </svg>
);

export const BuildingIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 21V9l8-5 8 5v12z" fill="#c9cdd3" stroke="#3b3f45" strokeWidth="1.2" />
    <rect x="10" y="14" width="4" height="7" fill="#3b3f45" />
    <rect x="7" y="10" width="3" height="3" fill="#5fc9ff" />
    <rect x="14" y="10" width="3" height="3" fill="#5fc9ff" />
  </svg>
);

export const MedalIcon = ({ size = 22 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M7 2h4l1 6-3 1zM17 2h-4l-1 6 3 1z" fill="#3a7bd5" />
    <circle cx="12" cy="15" r="6.5" fill="#f5c542" stroke="#a87b12" strokeWidth="1.5" />
    <path d="M12 11l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8L8 13.9l2.8-.3z" fill="#fff6cf" />
  </svg>
);

export const GlobeIcon = ({ size = 26 }: P) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="10" fill="#c99a3a" stroke="#5a3d0c" strokeWidth="1.5" />
    <path d="M2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20" stroke="#5a3d0c" strokeWidth="1.2" fill="none" />
  </svg>
);

export const GunIcon = ({ size = 22, color = "#7dff4d" }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 32 20">
    <path d="M1 7h26v4H15l-2 8h-4l1-6H7l-2 4H2l1-5H1z" fill={color} stroke="#14300a" strokeWidth="1.2" />
    <rect x="9" y="3" width="8" height="3" fill={color} stroke="#14300a" strokeWidth="1" />
  </svg>
);

export const SoundIcon = ({ size = 18, muted = false }: P & { muted?: boolean }) => (
  <svg width={size} height={size} viewBox="0 0 24 24">
    <path d="M4 9h4l5-4v14l-5-4H4z" fill="#fff" />
    {muted ? (
      <path d="M16 9l5 6M21 9l-5 6" stroke="#ff6b6b" strokeWidth="2.2" strokeLinecap="round" />
    ) : (
      <path d="M16 8.5c1.6 1.8 1.6 5.2 0 7M18.6 6c3 3.3 3 8.7 0 12" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" />
    )}
  </svg>
);
