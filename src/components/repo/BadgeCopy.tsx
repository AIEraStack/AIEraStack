import { useState } from 'react';

interface BadgeCopyProps {
  owner: string;
  name: string;
}

export function BadgeCopy({ owner, name }: BadgeCopyProps) {
  const [copied, setCopied] = useState(false);
  
  const badgeUrl = `https://aierastack.com/badge/${owner}/${name}.svg`;
  const repoUrl = `https://aierastack.com/repo/${owner}/${name}`;
  const markdown = `[![AI Era Stack](${badgeUrl})](${repoUrl})`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      const textArea = document.createElement('textarea');
      textArea.value = markdown;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="glass-card p-6 rounded-2xl">
      <h2 className="text-xl font-bold text-white mb-4">Add Badge to README</h2>
      
      <div className="flex items-center gap-4 mb-4">
        <img 
          src={badgeUrl} 
          alt="AI Era Stack Badge" 
          className="h-5"
        />
        <span className="text-sm text-[var(--text-muted)]">Preview</span>
      </div>
      
      <div className="relative">
        <pre className="bg-black/30 border border-white/10 rounded-lg p-4 pr-24 overflow-x-auto text-sm text-cyan-300 font-mono">
          {markdown}
        </pre>
        <button
          onClick={handleCopy}
          className={`absolute top-3 right-3 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
            copied 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-white/10 text-white hover:bg-white/20 border border-white/10'
          }`}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      
      <p className="text-xs text-[var(--text-muted)] mt-3">
        Paste this in your README.md to show your AI compatibility score.
      </p>
    </div>
  );
}
