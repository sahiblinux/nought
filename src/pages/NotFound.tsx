import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-start px-5 py-28 sm:px-8">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.24em] text-muted">Error 404</p>
      <h1 className="mt-5 font-serif text-4xl tracking-tight text-ink">
        Segmentation fault (page not found)
      </h1>
      <p className="mt-3 max-w-md text-[14.5px] leading-relaxed text-ink-soft">
        That address doesn't point anywhere. Try heading back to the language list.
      </p>
      <Link
        to="/"
        className="mt-8 rounded-full bg-ink px-5 py-2.5 text-[13.5px] text-paper transition-opacity hover:opacity-88"
      >
        Back to languages
      </Link>
    </div>
  );
}
