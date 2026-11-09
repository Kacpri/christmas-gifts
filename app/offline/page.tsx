export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <span className="text-5xl" aria-hidden>
        📡
      </span>
      <h1 className="text-[32px] text-cream">Brak internetu</h1>
      <p className="text-cream/80">
        Wygląda na to, że nie masz połączenia z siecią. Spróbuj ponownie za
        chwilę.
      </p>
    </main>
  );
}
