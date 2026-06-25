import Link from 'next/link';

interface LogoProps {
  className?: string;
  iconSize?: number;
  textSize?: string;
  withLink?: boolean;
}

export default function Logo({
  className = '',
  iconSize = 20,
  textSize = 'text-h3',
  withLink = true,
}: LogoProps) {
  const content = (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground font-bold flex-shrink-0">
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      </div>
      <span className={`font-semibold text-foreground tracking-tight ${textSize}`}>
        capms
      </span>
    </div>
  );

  if (withLink) {
    return <Link href="/">{content}</Link>;
  }

  return content;
}
