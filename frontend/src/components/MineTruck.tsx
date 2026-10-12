export function MineTruck({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 5h23l-3 13H7L3 5Z"
        fill="currentColor"
        fillOpacity=".17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M5 5 3 2M9 8h13M10 12h11M25 10h7l5 7v7H5v-6h19l1-8Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M28 12h3l3 5h-6v-5Z" fill="currentColor" />
      <path
        d="M1 24h37M17 19h5M35 20h2"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="11"
        cy="25"
        r="5"
        fill="#0b1220"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle
        cx="30"
        cy="25"
        r="5"
        fill="#0b1220"
        stroke="currentColor"
        strokeWidth="2"
      />
      <circle cx="11" cy="25" r="1.5" fill="currentColor" />
      <circle cx="30" cy="25" r="1.5" fill="currentColor" />
    </svg>
  );
}
