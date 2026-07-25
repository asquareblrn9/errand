"use client";

import { useEffect, useRef, useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import {
  Bold,
  Italic,
  UnderlineIcon,
  List,
  ListOrdered,
  LinkIcon,
  Undo2,
  Redo2,
  RemoveFormatting,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Toolbar button helper
// ---------------------------------------------------------------------------

function ToolbarButton({
  onClick,
  active,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "h-8 w-8 rounded-[min(var(--radius-md),12px)] inline-flex items-center justify-center",
        "text-muted-foreground hover:bg-muted hover:text-foreground",
        "transition-all duration-200",
        active && "bg-muted text-foreground",
        "disabled:opacity-30 disabled:pointer-events-none",
      )}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Toolbar divider
// ---------------------------------------------------------------------------

function ToolbarDivider() {
  return <div className="w-px h-5 bg-border mx-0.5 self-center" />;
}

// ---------------------------------------------------------------------------
// RichTextEditor
// ---------------------------------------------------------------------------

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  onBlur?: () => void;
  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
  minHeight?: string;
}

export function RichTextEditor({
  value,
  onChange,
  onBlur,
  placeholder = "Write something...",
  disabled = false,
  hasError = false,
  minHeight = "min-h-[120px]",
}: RichTextEditorProps) {
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Disable features we don't want
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
        strike: false,
        code: { HTMLAttributes: { class: "ProseMirror-code" } },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "cursor-pointer",
        },
      }),
    ],
    content: value,
    editable: !disabled,
    editorProps: {
      attributes: {
        class: cn(
          "prose prose-sm max-w-none outline-none",
          "text-foreground",
          minHeight,
          "px-3 py-2",
        ),
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    onBlur: () => {
      onBlur?.();
    },
    immediatelyRender: false, // avoids SSR hydration issues
  });

  // Sync external value changes back into the editor
  const prevValueRef = useRef(value);
  useEffect(() => {
    if (!editor) return;
    const currentHtml = editor.getHTML();
    // Only update if the value genuinely differs and isn't the result
    // of our own onUpdate callback (which already committed the change).
    if (value !== currentHtml && value !== prevValueRef.current) {
      editor.commands.setContent(value);
    }
    prevValueRef.current = value;
  }, [editor, value]);

  // Disable/enable editing when disabled prop changes
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!disabled);
  }, [editor, disabled]);

  // Focus the link input when it appears
  useEffect(() => {
    if (showLinkInput && linkInputRef.current) {
      linkInputRef.current.focus();
    }
  }, [showLinkInput]);

  if (!editor) {
    return (
      <div
        className={cn(
          "rounded-xl border bg-transparent",
          hasError ? "border-destructive" : "border-input",
          minHeight,
        )}
      />
    );
  }

  // ── Link handling ──────────────────────────────────────────

  const handleLinkClick = () => {
    const previousUrl = editor.getAttributes("link").href as string | undefined;
    if (previousUrl) {
      // Remove existing link
      editor.chain().focus().unsetLink().run();
      setShowLinkInput(false);
    } else if (editor.state.selection.empty) {
      // No selection — nothing to link
      return;
    } else {
      setLinkUrl("");
      setShowLinkInput(true);
    }
  };

  const handleSetLink = () => {
    if (!linkUrl.trim()) {
      setShowLinkInput(false);
      return;
    }
    // Normalise URL: add https:// if no protocol
    let href = linkUrl.trim();
    if (!/^https?:\/\//i.test(href)) {
      href = "https://" + href;
    }
    editor.chain().focus().setLink({ href }).run();
    setShowLinkInput(false);
  };

  const handleLinkKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleSetLink();
    if (e.key === "Escape") setShowLinkInput(false);
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <div
      className={cn(
        "rounded-xl border bg-transparent overflow-hidden transition-colors duration-200",
        hasError
          ? "border-destructive ring-2 ring-destructive/20"
          : "border-input focus-within:border-primary focus-within:ring-4 focus-within:ring-primary/15",
        disabled && "opacity-50 pointer-events-none",
        "dark:bg-input/30",
      )}
    >
      {/* ── Toolbar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-0.5 p-1 border-b border-input flex-wrap">
        {/* Text style */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          active={editor.isActive("bold")}
          title="Bold"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          active={editor.isActive("italic")}
          title="Italic"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          active={editor.isActive("underline")}
          title="Underline"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          active={editor.isActive("bulletList")}
          title="Bullet List"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          active={editor.isActive("orderedList")}
          title="Numbered List"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton
          onClick={handleLinkClick}
          active={editor.isActive("link")}
          title="Link"
        >
          <LinkIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* History */}
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Undo"
        >
          <Undo2 className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Redo"
        >
          <Redo2 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Clear formatting */}
        <ToolbarButton
          onClick={() => editor.chain().focus().clearNodes().unsetAllMarks().run()}
          title="Clear Formatting"
        >
          <RemoveFormatting className="w-4 h-4" />
        </ToolbarButton>
      </div>

      {/* ── Link input row ──────────────────────────────────── */}
      {showLinkInput && (
        <div className="flex items-center gap-1.5 px-1.5 py-1 border-b border-input bg-muted/30">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="https://example.com"
            className={cn(
              "h-8 rounded-lg border border-input bg-background px-2 text-sm flex-1",
              "transition-colors duration-200 outline-none",
              "focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/15",
            )}
          />
          <button
            type="button"
            onClick={handleSetLink}
            className="h-8 px-2 rounded-lg text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
          >
            Set
          </button>
          <button
            type="button"
            onClick={() => setShowLinkInput(false)}
            className="h-8 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* ── Editor content ──────────────────────────────────── */}
      <EditorContent editor={editor} />
    </div>
  );
}
