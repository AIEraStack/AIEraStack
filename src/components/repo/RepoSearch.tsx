import { useState } from 'react';

interface RepoSearchProps {
  onSearch?: (owner: string, name: string) => void;
}

export function RepoSearch({ onSearch }: RepoSearchProps) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmed = input.trim();
    const match = trimmed.match(/^([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_.-]+)$/);

    if (!match) {
      setError('Please enter a valid GitHub repo (e.g., facebook/react)');
      return;
    }

    const [, owner, name] = match;

    if (onSearch) {
      onSearch(owner, name);
    } else {
      window.location.href = `/repo/${owner}/${name}`;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="w-full">
      <div className="relative group">
        <div className="absolute inset-0 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-xl blur opacity-20 group-hover:opacity-30 transition duration-200"></div>
        <div className="relative flex items-center bg-[#0f1016] border border-white/10 rounded-xl overflow-hidden shadow-2xl transition-all group-focus-within:border-cyan-500/50 group-focus-within:ring-1 group-focus-within:ring-cyan-500/20">
          <div className="pl-5 text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search GitHub repo (e.g., tanstack/query)"
            className="w-full px-4 py-4 bg-transparent text-white placeholder-gray-500 focus:outline-none text-lg font-medium"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck="false"
          />
          <div className="pr-2">
            <button
              type="submit"
              className="px-4 py-2 bg-white/5 hover:bg-white/10 text-cyan-400 font-medium rounded-lg transition-colors flex items-center gap-2"
            >
              Analyze
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
                <polyline points="12 5 19 12 12 19"></polyline>
              </svg>
            </button>
          </div>
        </div>
      </div>
      {error && <p className="mt-3 text-sm text-red-400 pl-2 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
        {error}
      </p>}
    </form>
  );
}
