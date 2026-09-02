const { Resend } = require('resend');

/**
 * Resolve the sender ("from") address for Resend emails.
 * Priority: RESEND_FROM env var > fallback to Resend's shared test sender.
 */
function getFromAddress() {
  return 'GCES Kaveri Hostel <no-reply@gces.net.in>';
}

/**
 * Send an email via the Resend API.
 * Returns { success: true, messageId } on success,
 * or { success: false, error: '<user-friendly message>' } on failure.
 *
 * IMPORTANT: The `error` field returned on failure is ALWAYS a generic,
 * user-friendly message. Internal details are logged server-side only.
 */
async function sendEmail({ to, subject, text, html }) {
  const GENERIC_ERROR = 'Unable to send OTP at the moment. Please contact the administrator.';

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('[Mailer Error] RESEND_API_KEY is not set. OTP emails are disabled.');
    return { success: false, error: GENERIC_ERROR };
  }

  const fromAddress = getFromAddress();
  const resend = new Resend(apiKey);

  try {
    console.log(`[Mailer] Attempting to send email to ${to} from ${fromAddress} via Resend...`);

    const { data, error } = await resend.emails.send({
      from: fromAddress,
      to: Array.isArray(to) ? to : [to],
      subject,
      html: html || `<p>${text}</p>`,
      text: text || '',
    });

    if (error) {
      // Log full error details server-side for debugging
      console.error(`[Resend API Error]:`, JSON.stringify(error, null, 2));
      console.error(`[Mailer Error] Resend API rejected email to ${to}: ${JSON.stringify(error)}`);

      // Check for domain verification issues specifically
      if (error.statusCode === 403 || error.name === 'validation_error') {
        console.error(
          '[Mailer Error] Likely cause: Sender domain is not verified in Resend. ' +
          'Visit https://resend.com/domains to verify your domain.'
        );
      }

      // Never expose internal error details to the caller
      return { success: false, error: GENERIC_ERROR };
    }

    console.log(`[Mailer] OTP email sent successfully to ${to} via Resend (Message ID: ${data.id})`);
    return { success: true, messageId: data.id };
  } catch (err) {
    // Catch unexpected network/runtime errors
    console.error(`[Mailer Error] Unexpected failure sending email to ${to}:`, err.message || err);
    return { success: false, error: GENERIC_ERROR };
  }
}

module.exports = { sendEmail, getFromAddress };
