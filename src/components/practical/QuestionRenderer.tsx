import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowDown, ArrowUp, CheckCircle2, XCircle } from "lucide-react";

export type QuestionType = "multiple_choice" | "true_false" | "order_steps" | "find_error";

export interface OptionItem {
  id: string;
  text: string;
}

export interface CheckpointForStudent {
  id: string;
  question_type: QuestionType;
  question_text: string;
  options: OptionItem[];
  attempts_allowed: number;
  score: number;
}

interface Props {
  checkpoint: CheckpointForStudent;
  attemptsUsed: number;
  onSubmit: (answer: unknown) => Promise<void>;
  feedback?: { is_correct: boolean; feedback: string; exhausted: boolean } | null;
  disabled?: boolean;
  onContinue?: () => void;
  continueLabel?: string;
}

export function QuestionRenderer({ checkpoint, attemptsUsed, onSubmit, feedback, disabled, onContinue, continueLabel }: Props) {
  const [mcSingle, setMcSingle] = useState<string>("");
  const [mcMulti, setMcMulti] = useState<string[]>([]);
  const [tfValue, setTfValue] = useState<string>("");
  const [order, setOrder] = useState<OptionItem[]>([]);

  useEffect(() => {
    setMcSingle("");
    setMcMulti([]);
    setTfValue("");
    setOrder(checkpoint.options || []);
  }, [checkpoint.id]);

  const remaining = Math.max(0, checkpoint.attempts_allowed - attemptsUsed);

  const handleSubmit = async () => {
    let answer: unknown;
    switch (checkpoint.question_type) {
      case "multiple_choice":
        answer = mcSingle ? [mcSingle] : [];
        break;
      case "find_error":
        answer = mcMulti;
        break;
      case "true_false":
        answer = tfValue === "true";
        break;
      case "order_steps":
        answer = order.map(o => o.id);
        break;
    }
    await onSubmit(answer);
  };

  const move = (idx: number, dir: -1 | 1) => {
    setOrder(prev => {
      const next = [...prev];
      const newIdx = idx + dir;
      if (newIdx < 0 || newIdx >= next.length) return prev;
      [next[idx], next[newIdx]] = [next[newIdx], next[idx]];
      return next;
    });
  };

  const canSubmit = !disabled && (() => {
    switch (checkpoint.question_type) {
      case "multiple_choice": return !!mcSingle;
      case "find_error": return mcMulti.length > 0;
      case "true_false": return !!tfValue;
      case "order_steps": return order.length > 0;
    }
  })();

  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-heading font-bold">{checkpoint.question_text}</h3>
        <div className="text-xs text-muted-foreground">
          المحاولات المتبقية: <span className="font-bold text-foreground">{remaining}</span> / {checkpoint.attempts_allowed}
        </div>
      </div>

      {checkpoint.question_type === "multiple_choice" && (
        <RadioGroup value={mcSingle} onValueChange={setMcSingle} dir="rtl">
          {checkpoint.options.map(o => (
            <label key={o.id} className="flex items-center gap-3 p-3 rounded-md border border-border/50 cursor-pointer hover:bg-accent/40">
              <RadioGroupItem value={o.id} id={`mc-${o.id}`} />
              <span>{o.text}</span>
            </label>
          ))}
        </RadioGroup>
      )}

      {checkpoint.question_type === "find_error" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">اختر كل الإجابات التي تعتقد أنها تحتوي على خطأ</p>
          {checkpoint.options.map(o => {
            const checked = mcMulti.includes(o.id);
            return (
              <label key={o.id} className="flex items-center gap-3 p-3 rounded-md border border-border/50 cursor-pointer hover:bg-accent/40">
                <Checkbox checked={checked} onCheckedChange={(v) => {
                  setMcMulti(prev => v ? [...prev, o.id] : prev.filter(x => x !== o.id));
                }} />
                <span>{o.text}</span>
              </label>
            );
          })}
        </div>
      )}

      {checkpoint.question_type === "true_false" && (
        <RadioGroup value={tfValue} onValueChange={setTfValue} dir="rtl" className="flex gap-3">
          <label className="flex-1 flex items-center gap-3 p-3 rounded-md border border-border/50 cursor-pointer hover:bg-accent/40">
            <RadioGroupItem value="true" id="tf-t" />
            <span>صح</span>
          </label>
          <label className="flex-1 flex items-center gap-3 p-3 rounded-md border border-border/50 cursor-pointer hover:bg-accent/40">
            <RadioGroupItem value="false" id="tf-f" />
            <span>خطأ</span>
          </label>
        </RadioGroup>
      )}

      {checkpoint.question_type === "order_steps" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">رتّب الخطوات بالترتيب الصحيح من الأعلى إلى الأسفل</p>
          {order.map((o, idx) => (
            <div key={o.id} className="flex items-center gap-2 p-3 rounded-md border border-border/50 bg-card/50">
              <span className="font-bold text-primary w-6">{idx + 1}.</span>
              <span className="flex-1">{o.text}</span>
              <Button size="icon" variant="ghost" onClick={() => move(idx, -1)} disabled={idx === 0}>
                <ArrowUp className="w-4 h-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => move(idx, 1)} disabled={idx === order.length - 1}>
                <ArrowDown className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {feedback && (
        <div className={`p-3 rounded-md border flex items-start gap-2 ${feedback.is_correct ? "bg-green-500/10 border-green-500/40 text-green-700 dark:text-green-300" : "bg-destructive/10 border-destructive/40 text-destructive"}`}>
          {feedback.is_correct ? <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" /> : <XCircle className="w-5 h-5 shrink-0 mt-0.5" />}
          <div className="text-sm">{feedback.feedback}</div>
        </div>
      )}

      <div className="flex gap-2">
        {!feedback?.is_correct && !feedback?.exhausted && (
          <Button onClick={handleSubmit} disabled={!canSubmit} className="flex-1">إرسال الإجابة</Button>
        )}
        {(feedback?.is_correct || feedback?.exhausted) && onContinue && (
          <Button onClick={onContinue} className="flex-1">{continueLabel || "متابعة الفيديو"}</Button>
        )}
      </div>
    </div>
  );
}
