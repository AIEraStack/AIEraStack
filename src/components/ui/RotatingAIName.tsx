import { useState, useEffect } from 'react';

const AI_NAMES = [
  'your AI',
  'Sonnet',
  'Opus', 
  'Codex',
  'Gemini',
  'GPT-5',
  'Claude',
  'ChatGPT',
  'Gemini',
  'Copilot',
  'Cursor',
  'Windsurf',
  'Claude Code',
  'Cline',
  'Amp',
  'Cody',
  'Aider',
];

export function RotatingAIName() {
  const [index, setIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setIndex((prev) => (prev + 1) % AI_NAMES.length);
        setIsAnimating(false);
      }, 200);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  return (
    <span 
      className={`inline-block transition-all duration-200 ${
        isAnimating 
          ? 'opacity-0 translate-y-2' 
          : 'opacity-100 translate-y-0'
      }`}
    >
      {AI_NAMES[index]}
    </span>
  );
}
