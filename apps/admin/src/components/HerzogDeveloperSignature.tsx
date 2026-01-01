import Link from "next/link";

export function HerzogDeveloperSignature({
  className,
  tone = "dark",
}: {
  className?: string;
  tone?: "dark" | "light";
}) {
  const baseText = tone === "light" ? "text-white/90" : "text-zinc-600";
  const secondaryText = tone === "light" ? "text-white/70" : "text-zinc-600";
  const linkText = tone === "light" ? "text-white" : "text-zinc-800";

  return (
    <div className={`flex items-center gap-2 text-xs ${baseText} ${className ?? ""}`}>
      <span className={"opacity-90 " + secondaryText}>Desenvolvido por</span>
      <img
        src="/herzog-developer-icon.svg"
        alt="Herzog Developer"
        width={18}
        height={18}
        style={{ display: "block" }}
      />
      <Link
        href="https://github.com/douglasherzog"
        target="_blank"
        rel="noreferrer"
        className={`font-semibold ${linkText} hover:underline`}
      >
        Herzog Developer
      </Link>
    </div>
  );
}
