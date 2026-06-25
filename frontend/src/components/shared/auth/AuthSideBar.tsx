import Image from "next/image";
import SideImg from "../../../assets/images/sideillustration.png"
export default function AuthSideBar() {
  return (
    <div className="hidden lg:flex w-[40%] bg-primary flex-col justify-between p-12 relative overflow-hidden text-primary-text">
      {/* Decorative gradient flare */}
      <div className="absolute -top-[20%] -right-[20%] w-[300px] h-[300px] rounded-full bg-brand/10 blur-[120px] pointer-events-none" />
      <div className="absolute -bottom-[20%] -left-[20%] w-[300px] h-[300px] rounded-full bg-brand/5 blur-[120px] pointer-events-none" />

      {/* Main Illustration Area */}
      <div className="flex-1 flex flex-col justify-center items-center relative z-10">
        <div className="relative w-full max-w-[420px] aspect-[4/3] drop-shadow-2xl">
          <Image
            src={SideImg}
            alt="Workspace Illustration"
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 40vw"
            className="object-contain"
          />
        </div>
      </div>

      {/* Copywriting Section */}
      <div className="relative z-10 max-w-[380px] mt-auto">
        <h2 className="text-display text-primary-text leading-tight mb-4 tracking-tight">
          Work together.<br />Ship together.
        </h2>
        <p className="text-body text-text-muted leading-relaxed font-light">
          All the tools your team needs in one place.
        </p>
      </div>

     
    </div>
  );
}