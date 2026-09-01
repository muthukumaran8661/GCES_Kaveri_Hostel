const { Resend } = require('resend');

const FROM_ADDRESS = 'GCES <no-reply@gces.net.in>';

async function sendEmail({ to, subject, text, html }) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    console.error('[Mailer Error] Missing RESEND_API_KEY environment variable.');
    return {
      success: false,
      error: 'Unable to send OTP. Email service is not configured. Please add RESEND_API_KEY to environment variables.'
    };
  }

  const resend = new Resend(apiKey);

  const { data, error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: Array.isArray(to) ? to : [to],
    subject,
    html: html || `<p>${text}</p>`,
    text: text || '',
  });

  if (error) {
    console.error(`[Mailer Error] Resend failed to send email to ${to}:`, error);

    let userFriendlyError = 'Unable to send OTP. Please try again later.';
    if (error.name === 'validation_error') {
      userFriendlyError = 'Email configuration error: ' + (error.message || 'Invalid sender/recipient address.');
    } else if (error.name === 'missing_required_field') {
      userFriendlyError = 'Email service misconfiguration. Please contact the administrator.';
    } else if (error.message) {
      userFriendlyError = `Unable to send OTP: ${error.message}`;
    }

    return { success: false, error: userFriendlyError };
  }

  console.log(`[Mailer] OTP email sent to ${to} via Resend (Message ID: ${data.id})`);
  return { success: true, messageId: data.id };
}

module.exports = { sendEmail };
