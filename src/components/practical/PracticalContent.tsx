import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, MessageSquare, X } from "lucide-react";

export type ContentType = "video" | "case" | "image";
export interface Annotation { id: string; x: number; y: number; text: string; }

export const PRACTICAL_BUCKET = "practical-media";

export function useSignedImage(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!path) { setUrl(null); return; }
    if (/^https?:\/\//.test(path)) { setUrl(path); return; }
    supabase.storage.from(PRACTICAL_BUCKET).createSignedUrl(path, 60 * 60 * 6).then(({ data }) => setUrl(data?.signedUrl || null));
  }, [path]);
  return url;
}

export function CaseText({ text }: { text: string }) {
  return (
    <div dir="rtl" className="rounded-lg border border-border/50 bg-card p-5 leading-8 whitespace-pre-wrap text-[15px]">
      {text}
    </div>
  );
}

interface ImageProps {
  path: string | null;
  annotations: Annotation[];
  editable?: boolean;
  onAdd?: (a: Annotation) => void;
  onRemove?: (id: string) => void;
}

export function AnnotatedImage({ path, annotations, editable, onAdd, onRemove }: ImageProps) {
  const url = useSignedImage(path);
  const [open, setOpen] = useState<string | null>(null);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!editable || !onAdd) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;
    const text = window.prompt("اكتب التعليق على هذه النقطة:");
    if (text && text.trim()) onAdd({ id: crypto.randomUUID(), x, y, text: text.trim() });
  };

  if (!path) return <div className="text-sm text-muted-foreground text-center py-8 border rounded-lg">لا توجد صورة</div>;
  if (!url) return <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3" dir="rtl">
      <div className={`relative w-full rounded-lg overflow-hidden border border-border/50 ${editable ? "cursor-crosshair" : ""}`} onClick={handleClick}>
        <img src={url} alt="" className="w-full h-auto block select-none" draggable={false} />
        {annotations.map((a, i) => (
          <button
            key={a.id}
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(open === a.id ? null : a.id); }}
            className="absolute -translate-x-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-lg ring-2 ring-background"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            {i + 1}
          </button>
        ))}
        {annotations.map(a => open === a.id && (
          <div
            key={`p-${a.id}`}
            onClick={(e) => e.stopPropagation()}
            className="absolute z-10 max-w-[240px] -translate-x-1/2 mt-5 rounded-md bg-popover text-popover-foreground border shadow-lg p-2 text-sm"
            style={{ left: `${a.x}%`, top: `${a.y}%` }}
          >
            {a.text}
          </div>
        ))}
      </div>
      {editable && <p className="text-xs text-muted-foreground">اضغط على أي مكان في الصورة لإضافة تعليق مرقّم.</p>}
      {annotations.length > 0 && (
        <ol className="space-y-1.5 text-sm">
          {annotations.map((a, i) => (
            <li key={a.id} className="flex items-start gap-2 p-2 rounded-md bg-muted/40">
              <span className="w-6 h-6 shrink-0 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <MessageSquare className="w-4 h-4 mt-1 text-muted-foreground shrink-0" />
              <span className="flex-1">{a.text}</span>
              {editable && onRemove && (
                <button type="button" onClick={() => onRemove(a.id)} className="text-destructive"><X className="w-4 h-4" /></button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
