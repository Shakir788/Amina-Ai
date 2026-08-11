import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-black relative overflow-hidden">
      {/* 🌌 Background glow effects for Amina vibe */}
      <div className="absolute top-[20%] left-[20%] w-72 h-72 bg-purple-600/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[20%] right-[20%] w-96 h-96 bg-blue-600/20 rounded-full blur-[150px] pointer-events-none" />
      
      <div className="relative z-10">
        <SignIn
          appearance={{
            variables: {
              colorPrimary: "#a855f7",
              colorBackground: "#09090b",
              colorText: "white",
              colorInputBackground: "#18181b",
              colorInputText: "white",
              colorTextSecondary: "#a1a1aa",
            },
            elements: {
              card: "shadow-[0_0_50px_rgba(168,85,247,0.15)] border border-white/10 rounded-2xl bg-black/50 backdrop-blur-xl",
              headerTitle: "text-2xl font-bold text-white",
              headerSubtitle: "text-zinc-400",
              socialButtonsBlockButton: "border border-white/10 hover:bg-white/5 text-white transition-all",
              socialButtonsBlockButtonText: "text-white font-medium",
              formButtonPrimary: "hover:scale-[1.02] transition-transform shadow-[0_0_15px_rgba(168,85,247,0.4)]",
              formFieldInput: "border-white/10 focus:border-purple-500",
              formFieldLabel: "text-zinc-300",
              footerActionText: "text-zinc-400",
              footerActionLink: "text-purple-400 hover:text-purple-300",
              
              // 🔥 YAHAN CUSTOM CLASS ADD KI HAI (Watermark hide karne ke liye)
              footer: "custom-clerk-footer" 
            },
          }}
        />
      </div>
    </div>
  );
}