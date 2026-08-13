"use client";

import { formatDistanceToNow, parseISO } from "date-fns";
import { CheckCircle2, Clock, HelpCircle, Loader2, MessageSquarePlus, Paperclip, SendHorizonal } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import useSWR from "swr";

import { CollapsibleSection } from "@/components/shared/CollapsibleSection";
import { answerLeaveQuestion, askLeaveQuestion, getQuestionsUrl, uploadLeaveDocument } from "@/lib/api/leave-api";
import { cn } from "@/lib/utils";

export type QuestionItem = {
  id: string;
  leaveRequestId: string;
  askedBy: string;
  askedByRole: string;
  askedByName: string;
  question: string;
  answer: string | null;
  status: string;
  createdAt: string;
  answeredAt: string | null;
};

type AskAQuestionSectionProps = {
  leaveId: string;
  /** Show the "Ask a question" composer (staff view). Defaults to false. */
  canAsk?: boolean;
  /** Show the "Answer this question" action on pending questions (student view). Defaults to false. */
  canAnswer?: boolean;
};

const ROLE_STYLES: Record<string, string> = {
  STUDENT: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  POC: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  ADMIN: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  SUPER_ADMIN: "bg-red-500/10 text-red-600 border-red-500/20",
  PARENT: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
};

export function AskAQuestionSection({ leaveId, canAsk = false, canAnswer = false }: AskAQuestionSectionProps) {
  const [questionText, setQuestionText] = useState("");
  const [asking, setAsking] = useState(false);
  const [answeringId, setAnsweringId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data, isLoading, mutate } = useSWR<{ data: { items: QuestionItem[]; total: number } }>(
    getQuestionsUrl(leaveId, { limit: 50 }),
  );

  const questions = data?.data?.items ?? [];

  const handleAsk = useCallback(async () => {
    if (!questionText.trim()) return;

    setAsking(true);
    try {
      await askLeaveQuestion(leaveId, questionText.trim());
      toast.success("Question submitted");
      setQuestionText("");
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit question");
    } finally {
      setAsking(false);
    }
  }, [leaveId, questionText, mutate]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setSelectedFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  const handleAnswer = useCallback(async (questionId: string) => {
    if (!answerText.trim()) return;

    setSubmitting(true);
    try {
      if (selectedFile) {
        setUploadingFile(true);
        await uploadLeaveDocument(leaveId, selectedFile, "GENERAL");
        setUploadingFile(false);
      }

      await answerLeaveQuestion(leaveId, questionId, answerText.trim());
      toast.success("Answer submitted");
      setAnswerText("");
      setSelectedFile(null);
      setAnsweringId(null);
      await mutate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit answer");
    } finally {
      setSubmitting(false);
      setUploadingFile(false);
    }
  }, [leaveId, answerText, selectedFile, mutate]);

  if (isLoading) return <CollapsibleSection title="Questions" icon={HelpCircle}><div className="flex items-center justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div></CollapsibleSection>;
  if (questions.length === 0 && !canAsk) return null;

  return (
    <CollapsibleSection title="Questions" icon={HelpCircle}>
      <div className="space-y-4">
        {/* Ask a question (staff) */}
        {canAsk && (
          <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
              <MessageSquarePlus className="h-4 w-4 text-muted-foreground" />
              Ask the student a question
            </p>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="Type your question for the student..."
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
              disabled={asking}
            />
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleAsk}
                disabled={asking || !questionText.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {asking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <SendHorizonal className="h-4 w-4" />
                )}
                {asking ? "Submitting..." : "Ask Question"}
              </button>
            </div>
          </div>
        )}

        {questions.length === 0 && canAsk ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No questions yet. Ask the student for more information above.
          </p>
        ) : (
          questions.map((question) => (
            <div
              key={question.id}
              className={cn(
                "rounded-xl border border-border bg-card p-4 transition-all",
                question.status === "pending" && "ring-1 ring-amber-500/20",
              )}
            >
              {/* Question */}
              <div className="flex gap-3">
                <div className={cn(
                  "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                  ROLE_STYLES[question.askedByRole] ?? "bg-muted text-muted-foreground",
                )}>
                  {question.askedByName.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{question.askedByName}</span>
                    <span className="rounded bg-muted/50 px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                      {question.askedByRole}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(parseISO(question.createdAt), { addSuffix: true })}
                    </span>
                    <span className={cn(
                      "ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
                      question.status === "answered"
                        ? "bg-emerald-500/10 text-emerald-600"
                        : "bg-amber-500/10 text-amber-600",
                    )}>
                      {question.status === "answered" ? (
                        <CheckCircle2 className="h-3 w-3" />
                      ) : (
                        <Clock className="h-3 w-3" />
                      )}
                      {question.status === "answered" ? "Answered" : "Pending"}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed">{question.question}</p>
                </div>
              </div>

              {/* Answer (if answered) */}
              {question.answer && (
                <div className="mt-3 ml-12 rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                    <span>Answered{question.answeredAt ? ` ${formatDistanceToNow(parseISO(question.answeredAt), { addSuffix: true })}` : ""}</span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap">{question.answer}</p>
                </div>
              )}

              {/* Answer form for pending question */}
              {canAnswer && question.status === "pending" && answeringId === question.id && (
                <div className="mt-3 ml-12 space-y-3">
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    placeholder="Type your answer..."
                    rows={3}
                    className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none placeholder:text-muted-foreground focus:border-ring focus:ring-1 focus:ring-ring disabled:opacity-50"
                    disabled={submitting}
                  />

                  {/* File upload */}
                  <div className="flex items-center gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx"
                      className="hidden"
                      onChange={handleFileSelect}
                      disabled={submitting}
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={submitting}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/50 disabled:opacity-50"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                      {selectedFile ? selectedFile.name : "Attach document"}
                    </button>
                    {selectedFile && (
                      <button
                        onClick={() => setSelectedFile(null)}
                        className="text-xs text-destructive hover:underline"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleAnswer(question.id)}
                      disabled={submitting || !answerText.trim()}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
                    >
                      {(submitting || uploadingFile) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizonal className="h-4 w-4" />
                      )}
                      {uploadingFile ? "Uploading..." : submitting ? "Submitting..." : "Submit Answer"}
                    </button>
                    <button
                      onClick={() => { setAnsweringId(null); setAnswerText(""); setSelectedFile(null); }}
                      disabled={submitting}
                      className="text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Pending but not answering - show Answer button */}
              {canAnswer && question.status === "pending" && answeringId !== question.id && (
                <div className="mt-3 ml-12">
                  <button
                    onClick={() => setAnsweringId(question.id)}
                    className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80"
                  >
                    <SendHorizonal className="h-4 w-4" />
                    Answer this question
                  </button>
                </div>
              )}

              {/* Pending, staff viewer - hint */}
              {!canAnswer && question.status === "pending" && (
                <p className="mt-2 ml-12 text-xs text-muted-foreground">
                  Waiting for the student&apos;s response.
                </p>
              )}
            </div>
          ))
        )}
      </div>
    </CollapsibleSection>
  );
}
