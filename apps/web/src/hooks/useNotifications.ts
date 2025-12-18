import { useMutation } from "@tanstack/react-query";

export type NotificationType = "acceptance" | "rejection" | "interview_scheduled" | "interview_reminder";

export interface NotificationPayload {
  personId: string;
  type: NotificationType;
  recipientEmail: string;
  recipientName: string;
  customMessage?: string;
  metadata?: Record<string, unknown>;
}

export interface EmailTemplate {
  subject: string;
  body: string;
}

/**
 * Email templates for different notification types
 */
export const emailTemplates: Record<NotificationType, (name: string, customMessage?: string) => EmailTemplate> = {
  acceptance: (name, customMessage) => ({
    subject: "🎉 Congratulations! Your Application Has Been Accepted",
    body: `
Dear ${name},

We are thrilled to inform you that your application has been accepted!

${customMessage ? `\n${customMessage}\n` : ""}
We look forward to having you join our program. Our team will be in touch shortly with next steps regarding enrollment and payment.

If you have any questions in the meantime, please don't hesitate to reach out.

Warm regards,
The HKF Team
    `.trim(),
  }),

  rejection: (name, customMessage) => ({
    subject: "Update on Your Application",
    body: `
Dear ${name},

Thank you for your interest in our program and for taking the time to apply.

After careful consideration, we regret to inform you that we are unable to offer you a place in the program at this time.

${customMessage ? `\n${customMessage}\n` : ""}
We encourage you to apply again in the future, and we wish you all the best in your endeavors.

Warm regards,
The HKF Team
    `.trim(),
  }),

  interview_scheduled: (name, customMessage) => ({
    subject: "📅 Your Interview Has Been Scheduled",
    body: `
Dear ${name},

Great news! Your interview has been scheduled.

${customMessage ? `\n${customMessage}\n` : ""}
Please make sure to be available at the scheduled time. If you need to reschedule, please contact us as soon as possible.

We look forward to meeting you!

Warm regards,
The HKF Team
    `.trim(),
  }),

  interview_reminder: (name, customMessage) => ({
    subject: "⏰ Reminder: Your Interview is Tomorrow",
    body: `
Dear ${name},

This is a friendly reminder that your interview is scheduled for tomorrow.

${customMessage ? `\n${customMessage}\n` : ""}
Please ensure you have a stable internet connection and a quiet space for the call.

We look forward to speaking with you!

Warm regards,
The HKF Team
    `.trim(),
  }),
};

/**
 * Send a notification email
 * Note: This currently logs to console. In production, integrate with Brevo API.
 */
export function useSendNotification() {
  return useMutation({
    mutationFn: async (payload: NotificationPayload) => {
      const template = emailTemplates[payload.type](payload.recipientName, payload.customMessage);

      // TODO: Integrate with Brevo API
      // For now, we'll just log the email that would be sent
      console.log("📧 Email notification:", {
        to: payload.recipientEmail,
        subject: template.subject,
        body: template.body,
        type: payload.type,
        personId: payload.personId,
      });

      // In production, this would call the Brevo API:
      // const response = await fetch('/api/notifications/send', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({
      //     to: payload.recipientEmail,
      //     subject: template.subject,
      //     htmlContent: template.body.replace(/\n/g, '<br>'),
      //     templateId: getTemplateId(payload.type),
      //   }),
      // });

      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return {
        success: true,
        email: payload.recipientEmail,
        type: payload.type,
        timestamp: new Date().toISOString(),
      };
    },
  });
}

/**
 * Send acceptance notification
 */
export function useSendAcceptanceEmail() {
  const sendNotification = useSendNotification();

  return {
    ...sendNotification,
    mutateAsync: (params: { personId: string; email: string; name: string; message?: string }) => {
      return sendNotification.mutateAsync({
        personId: params.personId,
        type: "acceptance",
        recipientEmail: params.email,
        recipientName: params.name,
        customMessage: params.message,
      });
    },
  };
}

/**
 * Send rejection notification
 */
export function useSendRejectionEmail() {
  const sendNotification = useSendNotification();

  return {
    ...sendNotification,
    mutateAsync: (params: { personId: string; email: string; name: string; message?: string }) => {
      return sendNotification.mutateAsync({
        personId: params.personId,
        type: "rejection",
        recipientEmail: params.email,
        recipientName: params.name,
        customMessage: params.message,
      });
    },
  };
}

/**
 * Send interview scheduled notification
 */
export function useSendInterviewScheduledEmail() {
  const sendNotification = useSendNotification();

  return {
    ...sendNotification,
    mutateAsync: (params: { personId: string; email: string; name: string; interviewDate: string; message?: string }) => {
      return sendNotification.mutateAsync({
        personId: params.personId,
        type: "interview_scheduled",
        recipientEmail: params.email,
        recipientName: params.name,
        customMessage: params.message || `Your interview is scheduled for ${params.interviewDate}.`,
        metadata: { interviewDate: params.interviewDate },
      });
    },
  };
}
