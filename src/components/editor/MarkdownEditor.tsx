import React, { useState, useEffect, useRef } from "react";
import { Bold, Italic, Code, Link, Heading1, List, Sparkles, AlertCircle } from "lucide-react";
import DOMPurify from "dompurify";
import { apiFetch } from "@/src/lib/api";

interface MarkdownEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  projectId?: string;
}

function renderInlineMarkdown(line: string): string {
  return line
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, "<code class='bg-[#F4F4F4] px-1 rounded text-xs font-mono'>$1</code>")
    .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' class='text-[#0038BC] underline'>$1</a>");
}

export function MarkdownEditor({ value, onChange, placeholder = "Write something...", projectId }: MarkdownEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [showMention, setShowMention] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ users: any[]; teams: any[] }>({ users: [], teams: [] });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!projectId || !mentionQuery) { setSuggestions({ users: [], teams: [] }); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch(`/api/projects/${projectId}/mentionable?q=${encodeURIComponent(mentionQuery)}`);
        if (res.ok) setSuggestions(await res.json());
      } catch { }
    }, 150);
    return () => clearTimeout(t);
  }, [mentionQuery, projectId]);

  const insert = (before: string, after = "") => {
    const ta = textareaRef.current;
    if (!ta) return;
    const s = ta.selectionStart, e = ta.selectionEnd;
    const sel = value.substring(s, e);
    const next = value.substring(0, s) + before + sel + after + value.substring(e);
    onChange(next);
    setTimeout(() => { ta.focus(); ta.setSelectionRange(s + before.length, s + before.length + sel.length); }, 0);
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);
    if (showMention) {
      const before = val.substring(0, e.target.selectionStart);
      const at = before.lastIndexOf("@");
      if (at !== -1) setMentionQuery(before.substring(at + 1));
      else setShowMention(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "@" && projectId) { setShowMention(true); setMentionQuery(""); }
    if (showMention && (e.key === "Escape" || e.key === " ")) setShowMention(false);
  };

  const selectMention = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const before = value.substring(0, ta.selectionStart);
    const at = before.lastIndexOf("@");
    if (at === -1) return;
    const next = value.substring(0, at) + text + " " + value.substring(ta.selectionStart);
    onChange(next);
    setShowMention(false);
    setTimeout(() => { ta.focus(); const c = at + text.length + 1; ta.setSelectionRange(c, c); }, 0);
  };

  const toolbarBtns = [
    { icon: Bold, action: () => insert("**", "**"), title: "Bold" },
    { icon: Italic, action: () => insert("*", "*"), title: "Italic" },
    { icon: Heading1, action: () => insert("# "), title: "Heading" },
    { icon: List, action: () => insert("- "), title: "List" },
    { icon: Code, action: () => insert("`", "`"), title: "Code" },
    { icon: Link, action: () => { const u = prompt("URL:"); if (u) insert("[", `](${u})`); }, title: "Link" },
  ];

  return (
    <div className="border border-[#D0D0D0] rounded-lg overflow-hidden bg-white focus-within:border-[#0038BC] focus-within:ring-2 focus-within:ring-[#0038BC]/10 transition-colors">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#E8E8E8] bg-[#F7F8FA]">
        <div className="flex items-center gap-0.5">
          {toolbarBtns.map(({ icon: Icon, action, title }) => (
            <button key={title} type="button" onClick={action} title={title}
              className="p-1.5 text-slate-500 hover:text-[#111111] hover:bg-[#EEEEEE] rounded transition-colors">
              <Icon className="w-3.5 h-3.5" />
            </button>
          ))}
        </div>
        <div className="flex bg-[#EEEEEE] p-0.5 rounded-md text-xs">
          {["Write", "Preview"].map((t) => (
            <button key={t} type="button"
              onClick={() => setIsPreview(t === "Preview")}
              className={`px-2.5 py-1 rounded transition-colors ${(t === "Preview") === isPreview ? "bg-white text-[#111111] shadow-sm" : "text-slate-500"}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="relative">
        {!isPreview ? (
          <textarea ref={textareaRef} value={value} onChange={handleChange} onKeyDown={handleKeyDown}
            placeholder={placeholder} rows={4}
            className="w-full px-3 py-2.5 text-sm text-[#111111] placeholder:text-[#A0A0A0] focus:outline-none resize-y" />
        ) : (
          <div className="min-h-25 px-3 py-2.5 text-sm text-slate-600 prose prose-sm max-w-none">
            {value.trim() ? value.split("\n").map((line, i) => {
              const html = renderInlineMarkdown(line);
              if (line.startsWith("# ")) return <h3 key={i} className="font-semibold text-[#111111]">{line.slice(2)}</h3>;
              if (line.startsWith("- ")) return <li key={i} className="ml-4 list-disc">{line.slice(2)}</li>;
              return <p key={i} dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(html) }} />;
            }) : <span className="text-[#A0A0A0] italic">Nothing to preview.</span>}
          </div>
        )}

        {/* Mention dropdown */}
        {showMention && projectId && (
          <div className="absolute bottom-full mb-1 left-2 bg-white border border-[#E8E8E8] rounded-lg shadow-lg z-50 w-56 p-2">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 pb-1.5 border-b border-[#E8E8E8]">
              <Sparkles className="w-3 h-3 text-[#0038BC]" />
              Mentions
            </div>
            {suggestions.users.length === 0 && suggestions.teams.length === 0 ? (
              <div className="flex items-center gap-1.5 text-xs text-[#A0A0A0] py-1">
                <AlertCircle className="w-3.5 h-3.5" /> No matches
              </div>
            ) : (
              <div className="max-h-40 overflow-y-auto space-y-0.5">
                {suggestions.users.length > 0 && (
                  <>
                    <p className="text-xs text-[#A0A0A0] px-1 mb-1">Users</p>
                    {suggestions.users.map((u) => (
                      <button key={u.id} type="button" onClick={() => selectMention(`@${u.username}`)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#F4F4F4] text-sm flex items-center justify-between">
                        <span className="font-medium text-[#111111]">{u.name}</span>
                        <span className="text-xs text-[#A0A0A0]">@{u.username}</span>
                      </button>
                    ))}
                  </>
                )}
                {suggestions.teams.length > 0 && (
                  <>
                    <p className="text-xs text-[#A0A0A0] px-1 mt-1 mb-1">Teams</p>
                    {suggestions.teams.map((t) => (
                      <button key={t.id} type="button" onClick={() => selectMention(`@${t.name}`)}
                        className="w-full text-left px-2 py-1.5 rounded hover:bg-[#F4F4F4] text-sm flex items-center justify-between">
                        <span className="font-medium text-[#111111]">{t.name}</span>
                        <span className="text-xs text-[#0038BC]">Team</span>
                      </button>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}