export function BackgroundLayer() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />

      <div
        className="
          absolute inset-0
          opacity-[0.8]
        "
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)
          `,
          backgroundSize: "72px 72px",
        }}
      />

      <div
        className="
          absolute left-1/2 top-0
          h-[900px] w-[900px]
          -translate-x-1/2
          rounded-full
          bg-blue-500/12
          blur-[140px]
        "
      />

      <div
        className="
          absolute left-0 top-1/3
          h-[500px] w-[500px]
          rounded-full
          bg-cyan-500/10
          blur-[120px]
        "
      />

      <div
        className="
          absolute right-0 top-1/4
          h-[500px] w-[500px]
          rounded-full
          bg-indigo-500/10
          blur-[120px]
        "
      />

      <div
        className="
          absolute bottom-[-200px] left-1/2
          h-[700px] w-[700px]
          -translate-x-1/2
          rounded-full
          bg-primary/10
          blur-[140px]
        "
      />

      <div
        className="
          absolute inset-0
          bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,0.7)_100%)]
        "
      />

      <div
        className="
          absolute inset-x-0 top-0
          h-40
          bg-gradient-to-b
          from-black/40
          to-transparent
        "
      />

      <div
        className="
          absolute inset-0
          opacity-[0.03]
          mix-blend-soft-light
        "
        style={{
          // Inline feTurbulence noise — replaces the former external
          // grainy-gradients.vercel.app fetch, which sat in the paint path
          // of every landing visit and stalled first paint when that
          // third-party host was slow.
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}
