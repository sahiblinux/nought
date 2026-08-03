import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer className="mt-24 border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="font-serif text-lg text-ink">nought</p>
          <p className="mt-1 text-[12.5px] text-muted">
            Learn Python, C, C++, Java and Rust by writing real code.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[12.5px] text-muted">
          <Link to="/" className="transition-colors hover:text-ink">
            Languages
          </Link>
          <Link to="/playground" className="transition-colors hover:text-ink">
            Playground
          </Link>
          <Link to="/leaderboard" className="transition-colors hover:text-ink">
            Leaderboard
          </Link>
          <Link to="/profile" className="transition-colors hover:text-ink">
            Progress
          </Link>
        </nav>
      </div>
    </footer>
  );
}
