import { useEffect, useRef, useState } from "react";
import mermaid from "mermaid";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Maximize2, Minimize2, AlertCircle, Code } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ArchitectureDiagramProps {
  diagram: string;
  isVisible: boolean;
}

export default function ArchitectureDiagram({ diagram, isVisible }: ArchitectureDiagramProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const elementRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: true,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "Inter, sans-serif",
      flowchart: {
        useMaxWidth: true,
        htmlLabels: true,
        curve: 'basis'
      }
    });
  }, []);

  const superParse = (raw: string) => {
    if (!raw) return "";

    // 1. Extract markdown blocks
    const mermaidMatch = raw.match(/```mermaid\n?([\s\S]*?)\n?```/);
    let clean = mermaidMatch ? mermaidMatch[1] : raw;

    clean = clean.replace(/```/g, "").trim();

    let lines = clean.split('\n').map(l => l.trim()).filter(l => l.length > 0);

    // 2. Ensure header
    const hasHeader = lines.some(l => /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|gantt|pie|gitGraph)/i.test(l));
    if (!hasHeader && lines.length > 0) {
      lines.unshift("graph TD");
    }

    // 3. Robust Line Parsing
    let depth = 0;
    const parsedLines = lines.map(line => {
      // Stripping trailing punctuation and invisible whitespace that can break the parser
      let l = line.replace(/[;,\.]$/, '').trim();
      const lower = l.toLowerCase();

      // Logic for preserving subgraphs and ends
      if (/^\W*subgraph\s+/i.test(l)) {
        depth++;
        // Fix: subgraph "Title" -> subgraph Title_Safe ["Title"]
        const match = l.match(/subgraph\s+["'](.+)["']/i);
        if (match) {
          const title = match[1];
          const id = title.replace(/[^\w]/g, '_');
          return `subgraph ${id} ["${title}"]`;
        }

        // Fix: subgraph Title With Spaces -> subgraph Title_Safe ["Title With Spaces"]
        const matchNoQuotes = l.match(/subgraph\s+(.+)/i);
        if (matchNoQuotes) {
          const content = matchNoQuotes[1].trim();
          if (/^[\w_]+(\s+)?\[.+\]$/.test(content)) return l;

          const title = content;
          const id = title.replace(/[^\w]/g, '_');
          return `subgraph ${id} ["${title}"]`;
        }
        return l;
      }

      // Handle 'end' tags with stack balancing
      if (lower === 'end' || lower.startsWith('end ') || lower.endsWith(' end')) {
        if (depth > 0) {
          depth--;
          return 'end';
        }
        return null; // Strip orphan ends that break Mermaid
      }

      // Logic for cleaning connections
      if (l.includes('-->') || l.includes('-.->') || l.includes('==>')) {
        const separator = l.includes('-->') ? '-->' : l.includes('-.->') ? '-.->' : '==>';
        return l.split(separator).map(part => {
          let text = part.trim();
          if (!text) return "";

          const match = text.match(/^([\w\.\-]+)?\s*[\[\(\{\>](.*)[\]\)\}\>]$/);
          if (match) {
            const id = (match[1] || match[2]).replace(/[^\w]/g, '_');
            const label = match[2].trim();
            const startBracket = text.match(/[\[\(\{\>]/)?.[0] || '[';

            let endBracket = ']';
            if (startBracket === '(') endBracket = ')';
            if (startBracket === '{') endBracket = '}';

            return `${id}${startBracket}"${label.replace(/"/g, "'")}"${endBracket}`;
          }

          const safeId = text.replace(/[^\w]/g, '_');
          return `${safeId}["${text.replace(/"/g, "'")}"]`;
        }).join(` ${separator} `);
      }
      return l;
    }).filter(line => {
      if (!line) return false;
      const l = line.trim();
      if (l.startsWith('graph') || l.startsWith('flowchart')) return true;
      if (l.startsWith('subgraph') || l.startsWith('end')) return true;
      if (l.startsWith('style') || l.startsWith('classDef') || l.startsWith('linkStyle')) return true;
      if (l.includes('-->') || l.includes('-.->') || l.includes('==>') || l.includes('---')) return true;
      if (/^[\w]+(\s+)?[\(\[\{\>]+/.test(l)) return true;
      return false;
    });

    // Auto-close any orphaned subgraphs at end of graph
    for (let i = 0; i < depth; i++) {
      parsedLines.push('end');
    }

    return parsedLines.join('\n');
  };

  useEffect(() => {
    if (isVisible && diagram && elementRef.current) {
      const cleanDiagram = superParse(diagram);
      const renderId = `mermaid-${Math.random().toString(36).substr(2, 9)}`;

      elementRef.current.innerHTML = '';
      setError(null);

      try {
        mermaid.render(renderId, cleanDiagram).then(({ svg }) => {
          if (elementRef.current) {
            elementRef.current.innerHTML = svg;
          }
        }).catch(err => {
          console.error("Mermaid async error:", err);
          setError("Render failed. Using fallback view.");
        });
      } catch (err) {
        console.error("Mermaid sync error:", err);
        setError("Syntax error detected.");
      }
    }
  }, [diagram, isVisible]);

  if (!isVisible) return null;

  return (
    <Card className={`transition-all duration-300 bg-black/40 border-white/10 ${isExpanded ? "fixed inset-4 z-50 h-[95vh]" : "h-full"}`}>
      <CardHeader className="flex flex-row items-center justify-between py-3 border-b border-white/5">
        <CardTitle className="text-[10px] font-mono font-bold uppercase tracking-[0.3em] text-cyan-500 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
          SYSTEM BLUEPRINT
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRaw(!showRaw)}
            className="h-7 text-[9px] font-mono border-white/10 hover:bg-white/5 px-2 flex items-center gap-1"
          >
            {showRaw ? <Code className="w-3 h-3" /> : <Code className="w-3 h-3 opacity-50" />}
            {showRaw ? "VIEW DIAGRAM" : "VIEW CODE"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsExpanded(!isExpanded)}
            className="h-8 w-8 text-white/50 hover:text-white"
          >
            {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="h-[calc(100%-50px)] w-full overflow-hidden bg-black/20 p-2">
        {showRaw ? (
          <div className="w-full h-full bg-black/40 p-4 font-mono text-xs text-cyan-300/70 overflow-auto custom-scrollbar rounded border border-white/5">
            <pre className="whitespace-pre-wrap">{superParse(diagram)}</pre>
          </div>
        ) : (
          <div className="w-full h-full overflow-auto flex items-center justify-center custom-scrollbar relative">
            {error && (
              <div className="absolute top-2 right-2 bg-red-500/20 text-red-300 p-2 rounded text-[10px] font-mono border border-red-500/30 backdrop-blur-md z-10">
                Diagram Syntax Error - Showing Raw
              </div>
            )}
            <div
              ref={elementRef}
              className={`w-full h-full flex items-center justify-center [&>svg]:max-w-full [&>svg]:max-h-full [&>svg]:h-auto ${error ? 'opacity-0' : 'opacity-100'}`}
            />
            {error && (
              <div className="absolute inset-0 p-4 font-mono text-xs text-red-300/70 overflow-auto custom-scrollbar">
                <pre className="whitespace-pre-wrap">{superParse(diagram)}</pre>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
