/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { Bold, Italic, Code, Link, Heading1, List, AlertCircle, Sparkles } from "lucide-react";
import { useUIStore } from "../../store/ui-store.js";

interface TipTapEditorProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  projectId?: string; // If supplied, we fetch mentionables
}

export function TipTapEditor({ value, onChange, placeholder = "Write something useful...", projectId }: TipTapEditorProps) {
  const [isPreview, setIsPreview] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [showMentionDropdown, setShowMentionDropdown] = useState(false);
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 });
  
  const [mentionSuggestions, setMentionSuggestions] = useState<{
    users: { id: string; name: string; username: string; email: string }[];
    teams: { id: string; name: string; description: string }[];
  }>({ users: [], teams: [] });

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const token = useUIStore((state) => state.token);

  // Fetch mentionables if typing '@'
  useEffect(() => {
    if (!projectId || !token || !mentionQuery) {
      setMentionSuggestions({ users: [], teams: [] });
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}/mentionable?q=${encodeURIComponent(mentionQuery)}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setMentionSuggestions(data);
        }
      } catch (err) {
        console.warn("Error fetching mentionables:", err);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [mentionQuery, projectId, token]);

  // Insert custom Markdown/HTML marker
  const insertText = (before: string, after: string = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const originalText = textarea.value;

    const selectedText = originalText.substring(start, end);
    const replacement = before + (selectedText || "") + after;

    const newVal = originalText.substring(0, start) + replacement + originalText.substring(end);
    onChange(newVal);
    
    // Reset focus and cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "@" && projectId) {
      const textarea = textareaRef.current;
      if (!textarea) return;
      
      const { selectionStart } = textarea;
      const textBeforeCursor = textarea.value.substring(0, selectionStart);
      
      // Get coordinates of the cursor for dropdown (approximate)
      const rect = textarea.getBoundingClientRect();
      setMentionPosition({
        top: Math.min(200, rect.height - 30),
        left: Math.max(10, Math.min(rect.width - 250, (selectionStart % 30) * 8))
      });

      setShowMentionDropdown(true);
      setMentionQuery("");
    } else if (showMentionDropdown) {
      if (e.key === "Escape" || e.key === " ") {
        setShowMentionDropdown(false);
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    onChange(val);

    if (showMentionDropdown) {
      const textarea = textareaRef.current;
      if (textarea) {
        const { selectionStart } = textarea;
        const textBeforeCursor = val.substring(0, selectionStart);
        const atIndex = textBeforeCursor.lastIndexOf("@");
        if (atIndex !== -1) {
          const query = textBeforeCursor.substring(atIndex + 1);
          setMentionQuery(query);
        } else {
          setShowMentionDropdown(false);
        }
      }
    }
  };

  const selectMention = (mentionText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const { selectionStart } = textarea;
    const textBeforeCursor = textarea.value.substring(0, selectionStart);
    const atIndex = textBeforeCursor.lastIndexOf("@");
    
    if (atIndex !== -1) {
      const originalText = textarea.value;
      const newVal = 
        originalText.substring(0, atIndex) + 
        mentionText + " " + 
        originalText.substring(selectionStart);
      
      onChange(newVal);
      setShowMentionDropdown(false);
      
      setTimeout(() => {
        textarea.focus();
        const cursor = atIndex + mentionText.length + 1;
        textarea.setSelectionRange(cursor, cursor);
      }, 0);
    }
  };

  return (
    <div className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden transition-all duration-200 focus-within:border-theme-teal focus-within:ring-2 focus-within:ring-teal-100/40">
      {/* Editor Toolbar */}
      <div className="flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center space-x-1">
          <button
            type="button"
            onClick={() => insertText("**", "**")}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="Bold"
          >
            <Bold className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText("*", "*")}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="Italic"
          >
            <Italic className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText("# ", "")}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="Header"
          >
            <Heading1 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText("- ", "")}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="List"
          >
            <List className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => insertText("`", "`")}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="Code Block"
          >
            <Code className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              const url = prompt("Enter website URL link:");
              if (url) insertText(`[`, `](${url})`);
            }}
            className="p-1 px-2 text-slate-600 hover:bg-slate-200 hover:text-slate-900 rounded-md transition-colors"
            title="Link"
          >
            <Link className="w-4 h-4" />
          </button>
        </div>

        {/* Preview / Write Toggle */}
        <div className="flex bg-slate-200/60 p-0.5 rounded-lg text-xs font-semibold">
          <button
            type="button"
            onClick={() => setIsPreview(false)}
            className={`px-3 py-1 rounded-md transition-colors ${!isPreview ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-800"}`}
          >
            Write
          </button>
          <button
            type="button"
            onClick={() => setIsPreview(true)}
            className={`px-3 py-1 rounded-md transition-colors ${isPreview ? "bg-white text-slate-800 shadow-xs" : "text-slate-600 hover:text-slate-800"}`}
          >
            Formatted Preview
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="relative p-1">
        {!isPreview ? (
          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            rows={4}
            className="w-full px-4 py-3 text-slate-800 text-sm focus:outline-none resize-y border-0 placeholder:text-slate-400 font-sans"
          />
        ) : (
          <div className="min-h-[110px] w-full px-4 py-3 text-slate-800 text-sm overflow-y-auto whitespace-pre-wrap font-sans prose prose-slate">
            {value.trim() ? (
              // Simple Markdown Renderer
              value
                .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                .replace(/\*(.*?)\*/g, "<em>$1</em>")
                .replace(/`(.*?)`/g, "<code class='bg-slate-100 text-pink-600 px-1 py-0.5 rounded font-mono text-xs'>$1</code>")
                .replace(/\[(.*?)\]\((.*?)\)/g, "<a href='$2' target='_blank' rel='noopener noreferrer' class='text-theme-teal underline font-medium'>$1</a>")
                .split("\n")
                .map((line, idx) => {
                  if (line.startsWith("# ")) {
                    return <h3 key={idx} className="text-base font-bold text-slate-900 mt-2 mb-1">{line.replace("# ", "")}</h3>;
                  }
                  if (line.startsWith("- ")) {
                    return <li key={idx} className="ml-4 list-disc text-slate-700">{line.replace("- ", "")}</li>;
                  }
                  return <p key={idx} className="mb-1 text-slate-600" dangerouslySetInnerHTML={{ __html: line }} />;
                })
            ) : (
              <span className="text-slate-400 italic">Nothing to display. Write some content first.</span>
            )}
          </div>
        )}

        {/* TipTap @Mention Suggestions Dropdown Popup */}
        {showMentionDropdown && projectId && (
          <div
            className="absolute bg-white rounded-lg border border-slate-200 shadow-lg z-50 p-2.5 w-64 text-xs font-sans text-slate-700 font-medium"
            style={{ top: `${mentionPosition.top}px`, left: `${mentionPosition.left}px` }}
          >
            <div className="flex items-center space-x-1.5 pb-2 mb-2 border-b border-slate-100 text-[10px] uppercase font-mono tracking-wider text-slate-400">
              <Sparkles className="w-3.5 h-3.5 text-theme-teal" />
              <span>TipTap Mentionables List</span>
            </div>

            {/* Suggestions lists */}
            {mentionSuggestions.users.length === 0 && mentionSuggestions.teams.length === 0 ? (
              <div className="py-2 text-slate-400 text-center flex items-center justify-center space-x-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Typing... or no matching members</span>
              </div>
            ) : (
              <div className="max-h-48 overflow-y-auto space-y-2">
                {mentionSuggestions.users.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold mb-1 font-mono">USERS</div>
                    {mentionSuggestions.users.map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => selectMention(`@${u.username}`)}
                        className="w-full text-left p-1.5 rounded hover:bg-slate-100 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 truncate">{u.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono">@{u.username}</span>
                      </button>
                    ))}
                  </div>
                )}

                {mentionSuggestions.teams.length > 0 && (
                  <div>
                    <div className="text-[10px] text-slate-400 font-bold mb-1 font-mono">TEAMS</div>
                    {mentionSuggestions.teams.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectMention(`@${t.name}`)}
                        className="w-full text-left p-1.5 rounded hover:bg-slate-100 flex items-center justify-between"
                      >
                        <span className="font-semibold text-slate-800 truncate">{t.name}</span>
                        <span className="text-[10px] text-theme-teal font-mono">Team</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
