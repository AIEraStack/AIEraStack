import { useState, useRef, useEffect } from 'react';

interface CompareInputProps {
    defaultValue?: string;
    repoSlugs?: string[];
}

export function CompareInput({ defaultValue = '', repoSlugs = [] }: CompareInputProps) {
    const [input, setInput] = useState(defaultValue);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const [cursorPosition, setCursorPosition] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);
    const suggestionsRef = useRef<HTMLDivElement>(null);

    // Get the current word being typed (for multi-repo input)
    const getCurrentWord = (text: string, position: number): { word: string; start: number; end: number } => {
        const beforeCursor = text.slice(0, position);
        const afterCursor = text.slice(position);

        // Find the start of current word (after last comma or start)
        const lastComma = beforeCursor.lastIndexOf(',');
        const start = lastComma + 1;
        const wordBeforeCursor = beforeCursor.slice(start).trim();

        // Find end of current word (before next comma or end)
        const nextComma = afterCursor.indexOf(',');
        const end = nextComma === -1 ? text.length : position + nextComma;

        return { word: wordBeforeCursor, start, end };
    };

    // Filter suggestions based on current word
    useEffect(() => {
        const { word } = getCurrentWord(input, cursorPosition);

        if (word.length > 0 && repoSlugs.length > 0) {
            const query = word.toLowerCase();
            const filtered = repoSlugs
                .filter(slug => slug.toLowerCase().includes(query))
                .slice(0, 6);
            setSuggestions(filtered);
            setShowSuggestions(filtered.length > 0);
            setSelectedIndex(-1);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    }, [input, cursorPosition, repoSlugs]);

    // Close suggestions when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (
                suggestionsRef.current &&
                !suggestionsRef.current.contains(e.target as Node) &&
                inputRef.current &&
                !inputRef.current.contains(e.target as Node)
            ) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!showSuggestions || suggestions.length === 0) return;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
        } else if (e.key === 'Enter' && selectedIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        } else if (e.key === 'Tab' && selectedIndex >= 0) {
            e.preventDefault();
            selectSuggestion(suggestions[selectedIndex]);
        }
    };

    const selectSuggestion = (slug: string) => {
        const { start, end } = getCurrentWord(input, cursorPosition);
        const before = input.slice(0, start);
        const after = input.slice(end);

        // Construct new value with the selected slug
        const needsCommaAfter = after.trim().length > 0 && !after.trim().startsWith(',');
        const newValue = before + slug + (needsCommaAfter ? ', ' : '') + after;

        setInput(newValue);
        setShowSuggestions(false);
        setSelectedIndex(-1);

        // Move cursor to after the inserted slug
        const newPosition = before.length + slug.length + (needsCommaAfter ? 2 : 0);
        setTimeout(() => {
            if (inputRef.current) {
                inputRef.current.setSelectionRange(newPosition, newPosition);
                inputRef.current.focus();
                setCursorPosition(newPosition);
            }
        }, 0);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInput(e.target.value);
        setCursorPosition(e.target.selectionStart || 0);
    };

    const handleSelect = (e: React.SyntheticEvent<HTMLInputElement>) => {
        setCursorPosition((e.target as HTMLInputElement).selectionStart || 0);
    };

    return (
        <div className="relative flex-1">
            <input
                ref={inputRef}
                type="text"
                name="repos"
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                onSelect={handleSelect}
                onFocus={() => {
                    const { word } = getCurrentWord(input, cursorPosition);
                    if (word.length > 0 && suggestions.length > 0) {
                        setShowSuggestions(true);
                    }
                }}
                placeholder="facebook/react, vuejs/core, sveltejs/svelte"
                className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
            />

            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
                <div
                    ref={suggestionsRef}
                    className="absolute top-full left-0 right-0 mt-1 bg-[#0f1016] border border-white/10 rounded-xl overflow-hidden shadow-2xl z-50"
                >
                    {suggestions.map((slug, index) => (
                        <button
                            key={slug}
                            type="button"
                            onClick={() => selectSuggestion(slug)}
                            className={`w-full px-4 py-2.5 text-left text-white hover:bg-white/5 transition-colors flex items-center gap-3 ${index === selectedIndex ? 'bg-white/10' : ''
                                }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 flex-shrink-0">
                                <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path>
                            </svg>
                            <span className="font-mono text-sm">{slug}</span>
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
