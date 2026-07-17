"use client";

import { AlertTriangle, Bell, CheckCircle2, DoorOpen, QrCode, UserCheck, Users } from "lucide-react";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AutoPreviewModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  action: "approve" | "reject";
  studentName: string;
  onConfirm: () => void;
  loading?: boolean;
};

const EFFECTS = {
  approve: [
    { icon: Bell, label: "Notify Student", description: "SMS and email notification" },
    { icon: Users, label: "Notify Parent", description: "SMS confirmation" },
    { icon: Bell, label: "Notify Hostel Office", description: "Gate pass notification" },
    { icon: QrCode, label: "Generate Exit QR", description: "QR pass for gate access" },
    { icon: DoorOpen, label: "Update Student State", description: "IN_HOSTEL → APPROVED_LEAVE" },
    { icon: UserCheck, label: "Update Leave Status", description: "PENDING → APPROVED" },
  ],
  reject: [
    { icon: Bell, label: "Notify Student", description: "SMS and email notification" },
    { icon: Users, label: "Notify Parent", description: "SMS notification" },
    { icon: UserCheck, label: "Update Leave Status", description: "PENDING → REJECTED" },
    { icon: AlertTriangle, label: "No QR Generated", description: "Student stays in hostel" },
  ],
};

export function AutoPreviewModal({
  open,
  onOpenChange,
  action,
  studentName,
  onConfirm,
  loading,
}: AutoPreviewModalProps) {
  const effects = EFFECTS[action];

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            {action === "approve" ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            )}
            {action === "approve" ? "Approve Leave" : "Reject Leave"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {action === "approve"
              ? `Approving this leave for ${studentName} will trigger the following:`
              : `Rejecting this leave for ${studentName} will trigger the following:`}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-2">
          {effects.map((effect) => {
            const Icon = effect.icon;
            return (
              <div
                key={effect.label}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm",
                  action === "approve"
                    ? "bg-emerald-500/5"
                    : "bg-red-500/5",
                )}
              >
                <Icon
                  className={cn(
                    "h-4 w-4 shrink-0",
                    action === "approve" ? "text-emerald-500" : "text-red-500",
                  )}
                />
                <div>
                  <p className="font-medium">{effect.label}</p>
                  <p className="text-xs text-muted-foreground">{effect.description}</p>
                </div>
              </div>
            );
          })}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <Button
            variant={action === "approve" ? "default" : "destructive"}
            onClick={onConfirm}
            disabled={loading}
          >
            {action === "approve" ? "Yes, Approve" : "Yes, Reject"}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
