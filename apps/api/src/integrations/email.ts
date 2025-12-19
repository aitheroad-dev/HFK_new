/**
 * Email Integration Adapter (Brevo)
 *
 * Provides email sending capabilities using Brevo (formerly Sendinblue).
 * Supports transactional emails with templates and tracking.
 *
 * Environment variables:
 * - BREVO_API_KEY: API key from Brevo dashboard
 * - BREVO_SENDER_EMAIL: Default sender email (e.g., noreply@hkf.org.il)
 * - BREVO_SENDER_NAME: Default sender name (e.g., HKF)
 */

import * as brevo from '@getbrevo/brevo';

// Configuration from environment
const BREVO_API_KEY = process.env.BREVO_API_KEY;
const BREVO_SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'noreply@hkf.org.il';
const BREVO_SENDER_NAME = process.env.BREVO_SENDER_NAME || 'HKF';

// Brevo API client
let apiInstance: brevo.TransactionalEmailsApi | null = null;

/**
 * Initialize Brevo API client
 */
function getBrevoClient(): brevo.TransactionalEmailsApi | null {
  if (apiInstance) {
    return apiInstance;
  }

  if (!BREVO_API_KEY) {
    console.log('[Email] Brevo API key not configured. Set BREVO_API_KEY env var.');
    return null;
  }

  apiInstance = new brevo.TransactionalEmailsApi();
  apiInstance.setApiKey(brevo.TransactionalEmailsApiApiKeys.apiKey, BREVO_API_KEY);

  console.log('[Email] Brevo client initialized');
  return apiInstance;
}

/**
 * Email sending input
 */
export interface SendEmailInput {
  to: {
    email: string;
    name?: string;
  }[];
  subject: string;
  htmlContent?: string;
  textContent?: string;
  templateId?: number; // Brevo template ID
  params?: Record<string, string>; // Template variables
  sender?: {
    email: string;
    name: string;
  };
  replyTo?: {
    email: string;
    name?: string;
  };
  tags?: string[]; // For tracking
  attachments?: {
    name: string;
    content: string; // Base64 encoded
    contentType?: string;
  }[];
}

/**
 * Email sending result
 */
export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  message: string;
  error?: string;
}

/**
 * Send an email using Brevo
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const client = getBrevoClient();

  if (!client) {
    return {
      success: false,
      message: 'Email integration not configured',
      error: 'Set BREVO_API_KEY environment variable to enable email sending.',
    };
  }

  try {
    const sendSmtpEmail = new brevo.SendSmtpEmail();

    // Recipients
    sendSmtpEmail.to = input.to.map(recipient => ({
      email: recipient.email,
      name: recipient.name,
    }));

    // Sender
    sendSmtpEmail.sender = input.sender || {
      email: BREVO_SENDER_EMAIL,
      name: BREVO_SENDER_NAME,
    };

    // Subject
    sendSmtpEmail.subject = input.subject;

    // Content (either template or direct content)
    if (input.templateId) {
      sendSmtpEmail.templateId = input.templateId;
      if (input.params) {
        sendSmtpEmail.params = input.params;
      }
    } else {
      if (input.htmlContent) {
        sendSmtpEmail.htmlContent = input.htmlContent;
      }
      if (input.textContent) {
        sendSmtpEmail.textContent = input.textContent;
      }
    }

    // Reply-to
    if (input.replyTo) {
      sendSmtpEmail.replyTo = {
        email: input.replyTo.email,
        name: input.replyTo.name,
      };
    }

    // Tags for tracking
    if (input.tags && input.tags.length > 0) {
      sendSmtpEmail.tags = input.tags;
    }

    // Attachments
    if (input.attachments && input.attachments.length > 0) {
      sendSmtpEmail.attachment = input.attachments.map(att => ({
        name: att.name,
        content: att.content,
        contentType: att.contentType,
      }));
    }

    // Send the email
    const response = await client.sendTransacEmail(sendSmtpEmail);

    console.log('[Email] Email sent successfully:', response.body);

    return {
      success: true,
      messageId: (response.body as any).messageId || undefined,
      message: `Email sent to ${input.to.map(t => t.email).join(', ')}`,
    };
  } catch (error: any) {
    console.error('[Email] Failed to send email:', error.message);

    // Handle specific Brevo errors
    if (error.response?.body?.message) {
      return {
        success: false,
        message: 'Failed to send email',
        error: error.response.body.message,
      };
    }

    return {
      success: false,
      message: 'Failed to send email',
      error: error.message,
    };
  }
}

/**
 * Send a bulk email to multiple recipients
 */
export async function sendBulkEmail(
  recipients: { email: string; name?: string; params?: Record<string, string> }[],
  subject: string,
  htmlContent: string,
  options?: {
    sender?: { email: string; name: string };
    tags?: string[];
  }
): Promise<SendEmailResult> {
  const client = getBrevoClient();

  if (!client) {
    return {
      success: false,
      message: 'Email integration not configured',
      error: 'Set BREVO_API_KEY environment variable',
    };
  }

  // Brevo recommends sending individually for personalization
  // For truly bulk (1000+), use Brevo's campaign API instead
  const results: { email: string; success: boolean; error?: string }[] = [];

  for (const recipient of recipients) {
    try {
      // Replace template variables in content
      let personalizedHtml = htmlContent;
      if (recipient.params) {
        for (const [key, value] of Object.entries(recipient.params)) {
          personalizedHtml = personalizedHtml.replace(new RegExp(`{{${key}}}`, 'g'), value);
        }
      }

      const result = await sendEmail({
        to: [{ email: recipient.email, name: recipient.name }],
        subject,
        htmlContent: personalizedHtml,
        sender: options?.sender,
        tags: options?.tags,
      });

      results.push({
        email: recipient.email,
        success: result.success,
        error: result.error,
      });
    } catch (error: any) {
      results.push({
        email: recipient.email,
        success: false,
        error: error.message,
      });
    }
  }

  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  return {
    success: failed === 0,
    message: `Sent ${successful}/${recipients.length} emails${failed > 0 ? ` (${failed} failed)` : ''}`,
    error: failed > 0 ? results.filter(r => !r.success).map(r => `${r.email}: ${r.error}`).join('; ') : undefined,
  };
}

/**
 * Pre-built email templates for HKF
 */
export const emailTemplates = {
  /**
   * Acceptance email template (Hebrew)
   */
  acceptance: (params: {
    firstName: string;
    programName: string;
    cohortNumber?: string;
    startDate?: string;
    paymentLink?: string;
    customMessage?: string;
  }) => ({
    subject: `🎉 התקבלת לתכנית ${params.programName}!`,
    htmlContent: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #2e7d32;">מזל טוב! 🎉</h1>
        <p>שלום ${params.firstName},</p>
        <p>אנו שמחים לבשר לך שהתקבלת לתכנית <strong>${params.programName}</strong>!</p>
        ${params.cohortNumber ? `<p>מחזור: ${params.cohortNumber}</p>` : ''}
        ${params.startDate ? `<p>תאריך התחלה: ${params.startDate}</p>` : ''}
        ${params.customMessage ? `<p>${params.customMessage}</p>` : ''}
        ${params.paymentLink ? `
          <p style="margin-top: 20px;">
            <a href="${params.paymentLink}" style="background-color: #2e7d32; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
              לתשלום דמי ההשתתפות
            </a>
          </p>
        ` : ''}
        <p style="margin-top: 30px;">בברכה,<br>צוות HKF</p>
      </div>
    `,
    textContent: `
שלום ${params.firstName},

אנו שמחים לבשר לך שהתקבלת לתכנית ${params.programName}!
${params.cohortNumber ? `מחזור: ${params.cohortNumber}` : ''}
${params.startDate ? `תאריך התחלה: ${params.startDate}` : ''}
${params.customMessage || ''}
${params.paymentLink ? `לתשלום: ${params.paymentLink}` : ''}

בברכה,
צוות HKF
    `.trim(),
  }),

  /**
   * Rejection email template (Hebrew)
   */
  rejection: (params: {
    firstName: string;
    programName: string;
    customMessage?: string;
  }) => ({
    subject: `תודה על הגשת מועמדותך לתכנית ${params.programName}`,
    htmlContent: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <p>שלום ${params.firstName},</p>
        <p>תודה על הגשת מועמדותך לתכנית <strong>${params.programName}</strong>.</p>
        <p>לאחר בחינה מעמיקה, החלטנו שהתכנית אינה מתאימה לך בשלב זה.</p>
        ${params.customMessage ? `<p>${params.customMessage}</p>` : ''}
        <p>אנו מזמינים אותך לשמור על קשר ולהגיש מועמדות למחזורים הבאים.</p>
        <p style="margin-top: 30px;">בברכה,<br>צוות HKF</p>
      </div>
    `,
    textContent: `
שלום ${params.firstName},

תודה על הגשת מועמדותך לתכנית ${params.programName}.

לאחר בחינה מעמיקה, החלטנו שהתכנית אינה מתאימה לך בשלב זה.
${params.customMessage || ''}

אנו מזמינים אותך לשמור על קשר ולהגיש מועמדות למחזורים הבאים.

בברכה,
צוות HKF
    `.trim(),
  }),

  /**
   * Interview scheduled email template (Hebrew)
   */
  interviewScheduled: (params: {
    firstName: string;
    programName: string;
    interviewDate: string;
    interviewTime: string;
    location?: string;
    interviewerName?: string;
    customMessage?: string;
  }) => ({
    subject: `זימון לראיון - תכנית ${params.programName}`,
    htmlContent: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #1976d2;">זימון לראיון 📅</h2>
        <p>שלום ${params.firstName},</p>
        <p>זומנת לראיון לתכנית <strong>${params.programName}</strong>.</p>
        <div style="background-color: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>📅 תאריך:</strong> ${params.interviewDate}</p>
          <p><strong>⏰ שעה:</strong> ${params.interviewTime}</p>
          ${params.location ? `<p><strong>📍 מיקום:</strong> ${params.location}</p>` : ''}
          ${params.interviewerName ? `<p><strong>👤 מראיין/ת:</strong> ${params.interviewerName}</p>` : ''}
        </div>
        ${params.customMessage ? `<p>${params.customMessage}</p>` : ''}
        <p>נא לאשר את הגעתך בהקדם.</p>
        <p style="margin-top: 30px;">בברכה,<br>צוות HKF</p>
      </div>
    `,
    textContent: `
שלום ${params.firstName},

זומנת לראיון לתכנית ${params.programName}.

📅 תאריך: ${params.interviewDate}
⏰ שעה: ${params.interviewTime}
${params.location ? `📍 מיקום: ${params.location}` : ''}
${params.interviewerName ? `👤 מראיין/ת: ${params.interviewerName}` : ''}

${params.customMessage || ''}

נא לאשר את הגעתך בהקדם.

בברכה,
צוות HKF
    `.trim(),
  }),

  /**
   * Interview reminder email template (Hebrew)
   */
  interviewReminder: (params: {
    firstName: string;
    programName: string;
    interviewDate: string;
    interviewTime: string;
    location?: string;
  }) => ({
    subject: `תזכורת: ראיון מחר - ${params.programName}`,
    htmlContent: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #ff9800;">תזכורת לראיון ⏰</h2>
        <p>שלום ${params.firstName},</p>
        <p>זוהי תזכורת לראיון שלך לתכנית <strong>${params.programName}</strong>.</p>
        <div style="background-color: #fff3e0; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ff9800;">
          <p><strong>📅 תאריך:</strong> ${params.interviewDate}</p>
          <p><strong>⏰ שעה:</strong> ${params.interviewTime}</p>
          ${params.location ? `<p><strong>📍 מיקום:</strong> ${params.location}</p>` : ''}
        </div>
        <p>מצפים לראותך!</p>
        <p style="margin-top: 30px;">בברכה,<br>צוות HKF</p>
      </div>
    `,
    textContent: `
שלום ${params.firstName},

תזכורת לראיון שלך לתכנית ${params.programName}.

📅 תאריך: ${params.interviewDate}
⏰ שעה: ${params.interviewTime}
${params.location ? `📍 מיקום: ${params.location}` : ''}

מצפים לראותך!

בברכה,
צוות HKF
    `.trim(),
  }),

  /**
   * Payment reminder email template (Hebrew)
   */
  paymentReminder: (params: {
    firstName: string;
    programName: string;
    amount: string;
    paymentLink: string;
    dueDate?: string;
  }) => ({
    subject: `תזכורת תשלום - ${params.programName}`,
    htmlContent: `
      <div dir="rtl" style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #f44336;">תזכורת תשלום 💳</h2>
        <p>שלום ${params.firstName},</p>
        <p>טרם שולמו דמי ההשתתפות לתכנית <strong>${params.programName}</strong>.</p>
        <div style="background-color: #ffebee; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f44336;">
          <p><strong>סכום לתשלום:</strong> ${params.amount} ₪</p>
          ${params.dueDate ? `<p><strong>תאריך אחרון לתשלום:</strong> ${params.dueDate}</p>` : ''}
        </div>
        <p style="margin-top: 20px;">
          <a href="${params.paymentLink}" style="background-color: #f44336; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
            לתשלום עכשיו
          </a>
        </p>
        <p style="margin-top: 20px; color: #666;">במידה ושילמת, אנא התעלם/י מהודעה זו.</p>
        <p style="margin-top: 30px;">בברכה,<br>צוות HKF</p>
      </div>
    `,
    textContent: `
שלום ${params.firstName},

טרם שולמו דמי ההשתתפות לתכנית ${params.programName}.

סכום לתשלום: ${params.amount} ₪
${params.dueDate ? `תאריך אחרון לתשלום: ${params.dueDate}` : ''}

לתשלום: ${params.paymentLink}

במידה ושילמת, אנא התעלם/י מהודעה זו.

בברכה,
צוות HKF
    `.trim(),
  }),
};

/**
 * Check if email integration is configured
 */
export async function checkEmailStatus(): Promise<{
  configured: boolean;
  authenticated: boolean;
  senderEmail: string;
  senderName: string;
  message: string;
}> {
  const client = getBrevoClient();

  if (!client) {
    return {
      configured: false,
      authenticated: false,
      senderEmail: BREVO_SENDER_EMAIL,
      senderName: BREVO_SENDER_NAME,
      message: 'Brevo API key not configured. Set BREVO_API_KEY env var.',
    };
  }

  try {
    // Try to get account info to verify API key works
    const accountApi = new brevo.AccountApi();
    accountApi.setApiKey(brevo.AccountApiApiKeys.apiKey, BREVO_API_KEY!);
    await accountApi.getAccount();

    return {
      configured: true,
      authenticated: true,
      senderEmail: BREVO_SENDER_EMAIL,
      senderName: BREVO_SENDER_NAME,
      message: 'Email integration is working',
    };
  } catch (error: any) {
    return {
      configured: true,
      authenticated: false,
      senderEmail: BREVO_SENDER_EMAIL,
      senderName: BREVO_SENDER_NAME,
      message: `Brevo authentication failed: ${error.message}`,
    };
  }
}
