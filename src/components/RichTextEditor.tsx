import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Bold,
  Italic,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ImageIcon,
  Link as LinkIcon,
  Undo2,
  Redo2,
} from "lucide-react";
import { useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);
  const linkUrlRef = useRef<string>("");

  const editor = useEditor({
    extensions: [
      StarterKit,
      Image.configure({
        allowBase64: false,
        HTMLAttributes: {
          class: "max-w-full h-auto rounded-lg border border-border",
        },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: "text-primary underline cursor-pointer hover:text-primary/80",
        },
      }),
    ],
    content: value || `<p>${placeholder || ""}</p>`,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class:
          "prose prose-sm dark:prose-invert max-w-none focus:outline-none min-h-[420px] px-4 py-3 text-base leading-8",
      },
      handlePaste(view, event) {
        const items = event.clipboardData?.items;
        if (!items) return false;

        for (const item of items) {
          if (item.type.startsWith("image/")) {
            event.preventDefault();
            const file = item.getAsFile();
            if (file) {
              void handleImageUpload(file);
            }
            return true;
          }
        }
        return false;
      },
    },
  });

  const handleImageUpload = async (file: File) => {
    const fileName = `article-${Date.now()}-${file.name}`;
    const { data, error } = await supabase.storage.from("articles").upload(fileName, file);

    if (error) {
      toast({
        title: "Error al subir imagen",
        description: error.message,
        variant: "destructive",
      });
      return;
    }

    const { data: publicUrl } = supabase.storage.from("articles").getPublicUrl(data.path);

    if (editor) {
      editor.chain().focus().setImage({ src: publicUrl.publicUrl }).run();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        toast({
          title: "Tipo de archivo inválido",
          description: "Por favor selecciona una imagen.",
          variant: "destructive",
        });
        return;
      }
      void handleImageUpload(file);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleLinkAdd = () => {
    if (linkUrlRef.current && editor) {
      editor.chain().focus().setLink({ href: linkUrlRef.current }).run();
      linkUrlRef.current = "";
      if (linkInputRef.current) linkInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (editor && value && editor.getHTML() !== value) {
      editor.commands.setContent(value, false);
    }
  }, [value, editor]);

  if (!editor) return null;

  return (
    <div className="w-full border border-border rounded-lg bg-background overflow-hidden">
      <div className="border-b border-border bg-muted/30 p-3 flex flex-wrap gap-1">
        <Button
          size="sm"
          variant={editor.isActive("bold") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBold().run()}
          title="Negrita (Ctrl+B)"
        >
          <Bold className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive("italic") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleItalic().run()}
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="h-4 w-4" />
        </Button>

        <div className="border-l border-border mx-1" />

        <Button
          size="sm"
          variant={editor.isActive("heading", { level: 2 }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          title="Título 2 (Ctrl+Alt+2)"
        >
          <Heading2 className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive("heading", { level: 3 }) ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          title="Título 3 (Ctrl+Alt+3)"
        >
          <Heading3 className="h-4 w-4" />
        </Button>

        <div className="border-l border-border mx-1" />

        <Button
          size="sm"
          variant={editor.isActive("bulletList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          title="Lista"
        >
          <List className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant={editor.isActive("orderedList") ? "default" : "outline"}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          title="Lista numerada"
        >
          <ListOrdered className="h-4 w-4" />
        </Button>

        <div className="border-l border-border mx-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          title="Insertar imagen (Ctrl+Shift+I)"
        >
          <ImageIcon className="h-4 w-4" />
        </Button>

        <Button size="sm" variant="outline" onClick={() => linkInputRef.current?.focus()} title="Insertar enlace">
          <LinkIcon className="h-4 w-4" />
        </Button>

        <div className="border-l border-border mx-1" />

        <Button
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo2 className="h-4 w-4" />
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo2 className="h-4 w-4" />
        </Button>
      </div>

      <div className="p-2 border-b border-border bg-muted/10">
        <div className="flex gap-2">
          <Input
            ref={linkInputRef}
            type="url"
            placeholder="URL para enlace"
            className="text-xs h-8"
            onChange={(e) => (linkUrlRef.current = e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleLinkAdd();
            }}
          />
          <Button size="sm" onClick={handleLinkAdd} disabled={!linkUrlRef.current}>
            Aplicar
          </Button>
        </div>
      </div>

      <EditorContent editor={editor} />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: "none" }}
      />
    </div>
  );
}
