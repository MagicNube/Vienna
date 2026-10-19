export function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 64 64" aria-hidden="true">
      <defs>
        <clipPath id="vienna-brand-clip">
          <rect x="4" y="4" width="56" height="56" rx="12" />
        </clipPath>
      </defs>
      <rect width="64" height="64" rx="16" fill="var(--nav-active)" />
      <g clipPath="url(#vienna-brand-clip)">
        <path fill="var(--light-square)" d="M4 4h56v56H4z" />
        <path
          fill="var(--dark-square)"
          d="M4 4h14v14H4zM32 4h14v14H32zM18 18h14v14H18zM46 18h14v14H46zM4 32h14v14H4zM32 32h14v14H32zM18 46h14v14H18zM46 46h14v14H46z"
        />
      </g>
    </svg>
  );
}
