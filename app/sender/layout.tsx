export default function AboutLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col items-center gap-2 py-2 md:py-4 px-2 sm:px-4">
      <div className="w-full max-w-6xl 2xl:max-w-7xl">
        {children}
      </div>
    </section>
  );
}
