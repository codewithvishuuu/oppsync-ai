/**
 * OppSync mark — three linked nodes. Geometric, favicon-scalable, no
 * external asset. Uses currentColor so it inherits context.
 */
export default function Mark({
  size = 18,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <rect x="1" y="1" width="7" height="7" stroke="currentColor" strokeWidth="1.7" />
      <rect x="12" y="1" width="7" height="7" fill="currentColor" />
      <rect x="1" y="12" width="7" height="7" fill="currentColor" />
      <path
        d="M8 4.5h4M8 15.5h4M4.5 8v4"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </svg>
  );
}
