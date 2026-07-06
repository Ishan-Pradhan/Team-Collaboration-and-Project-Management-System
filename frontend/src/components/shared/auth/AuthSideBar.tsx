import AuthShowcase from './AuthShowcase';

interface AuthSideBarProps {
  headline?: React.ReactNode;
  subtext?: string;
}

export default function AuthSideBar({
  headline = <>Work together.<br />Ship together.</>,
  subtext = 'All the tools your team needs in one place.',
}: AuthSideBarProps) {
  return (
    <div className="hidden lg:flex w-[40%] bg-primary flex-col justify-between p-12 relative overflow-hidden text-primary-text">
      {/* Decorative gradient flare */}
      <div className="absolute -top-[20%] -right-[20%] w-[300px] h-[300px] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[20%] w-[300px] h-[300px] rounded-full bg-brand/5 blur-[120px] pointer-events-none" />

      {/* Product preview */}
      <div className="flex-1 flex flex-col justify-center items-center relative z-10">
        <AuthShowcase />
      </div>

      {/* Copywriting Section */}
      <div className="relative z-10 max-w-[380px] mt-auto">
        <h2 className="text-display text-primary-text leading-tight mb-4 tracking-tight">
          {headline}
        </h2>
        <p className="text-body text-text-muted leading-relaxed font-light">
          {subtext}
        </p>
      </div>
    </div>
  );
}
