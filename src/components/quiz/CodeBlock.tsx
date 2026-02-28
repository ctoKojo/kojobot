import { cn } from '@/lib/utils';
import { useMemo } from 'react';

interface CodeBlockProps {
  code: string;
  className?: string;
}

// Lightweight syntax highlighter using regex tokenization
function highlightCode(code: string): React.ReactNode[] {
  // Order matters: comments and strings first, then keywords, then numbers
  const tokenRules: [RegExp, string][] = [
    // Single-line comments (Python #, JS //)
    [/(#[^\n]*|\/\/[^\n]*)/g, 'text-emerald-400'],
    // Multi-line comments
    [/(\/\*[\s\S]*?\*\/)/g, 'text-emerald-400'],
    // Triple-quoted strings
    [/("""[\s\S]*?"""|'''[\s\S]*?''')/g, 'text-amber-300'],
    // Double-quoted strings
    [/("(?:[^"\\]|\\.)*")/g, 'text-amber-300'],
    // Single-quoted strings
    [/('(?:[^'\\]|\\.)*')/g, 'text-amber-300'],
    // Template literals
    [/(`(?:[^`\\]|\\.)*`)/g, 'text-amber-300'],
    // Python/JS keywords
    [/\b(def|class|return|import|from|as|if|elif|else|for|while|in|not|and|or|is|try|except|finally|raise|with|yield|lambda|pass|break|continue|del|global|nonlocal|assert|async|await|True|False|None|function|const|let|var|new|this|typeof|instanceof|void|delete|throw|catch|switch|case|default|do|export|extends|super|static|get|set|of)\b/g, 'text-purple-400'],
    // Built-in functions
    [/\b(print|len|range|input|int|str|float|list|dict|set|tuple|type|isinstance|enumerate|zip|map|filter|sorted|reversed|abs|max|min|sum|round|open|format|append|pop|remove|insert|extend|join|split|strip|replace|find|upper|lower|title|startswith|endswith|isdigit|isalpha|keys|values|items|console|log|document|window|alert|prompt|Math|Array|Object|String|Number|JSON|parseInt|parseFloat|setTimeout|addEventListener)\b/g, 'text-cyan-300'],
    // HTML/CSS tags
    [/(&lt;\/?[a-zA-Z][a-zA-Z0-9]*|<\/?[a-zA-Z][a-zA-Z0-9]*)/g, 'text-red-400'],
    // Numbers
    [/\b(\d+\.?\d*)\b/g, 'text-orange-300'],
    // Decorators (@)
    [/(@\w+)/g, 'text-yellow-300'],
  ];

  // Build a combined regex with named groups
  const combined = tokenRules
    .map(([re, _], i) => `(?<t${i}>${re.source})`)
    .join('|');
  const masterRe = new RegExp(combined, 'g');

  const result: React.ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;

  for (const match of code.matchAll(masterRe)) {
    const matchStart = match.index!;
    const matchText = match[0];

    // Push plain text before the match
    if (matchStart > lastIndex) {
      result.push(code.slice(lastIndex, matchStart));
    }

    // Find which group matched
    let colorClass = '';
    for (let i = 0; i < tokenRules.length; i++) {
      if (match.groups?.[`t${i}`] !== undefined) {
        colorClass = tokenRules[i][1];
        break;
      }
    }

    result.push(
      <span key={key++} className={colorClass}>
        {matchText}
      </span>
    );

    lastIndex = matchStart + matchText.length;
  }

  // Push remaining text
  if (lastIndex < code.length) {
    result.push(code.slice(lastIndex));
  }

  return result;
}

export function CodeBlock({ code, className }: CodeBlockProps) {
  const highlighted = useMemo(() => (code ? highlightCode(code) : null), [code]);

  if (!code) return null;

  return (
    <div
      dir="ltr"
      className={cn(
        'rounded-lg bg-zinc-900 text-zinc-100 p-4 font-mono text-sm leading-relaxed overflow-x-auto whitespace-pre',
        className
      )}
    >
      {highlighted}
    </div>
  );
}
