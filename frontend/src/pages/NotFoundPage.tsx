import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      <div className="text-8xl mb-6">♟</div>
      <h1 className="text-4xl font-bold text-white mb-2">404 — Page not found</h1>
      <p className="text-gray-400 mb-8">
        Looks like you made an illegal move. This page doesn't exist.
      </p>
      <Link to="/" className="btn-primary">
        Back to Home
      </Link>
    </div>
  );
}
