const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const smtpService = process.env.SMTP_SERVICE || process.env.EMAIL_SERVICE;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST || (smtpService ? undefined : 'smtp.gmail.com');
  const smtpPort = process.env.SMTP_PORT || process.env.EMAIL_PORT || 587;
  const smtpFrom = process.env.SMTP_FROM || process.env.EMAIL_FROM || smtpUser;

  if (!smtpUser || !smtpPass) {
    console.error('[Mailer Error] Missing SMTP_USER or SMTP_PASS environment variables.');
    return {
      success: false,
      error: 'Unable to send OTP. Email service is not configured on the server. Please add SMTP_USER and SMTP_PASS to environment variables.'
    };
  }

  let transporterConfig;

  if (smtpService) {
    transporterConfig = {
      service: smtpService,
      auth: { user: smtpUser, pass: smtpPass }
    };
  } else {
    transporterConfig = {
      host: smtpHost,
      port: Number(smtpPort),
      secure: Number(smtpPort) === 465,
      auth: { user: smtpUser, pass: smtpPass },
      tls: {
        rejectUnauthorized: false
      },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000
    };
  }

  try {
    const transporter = nodemailer.createTransport(transporterConfig);

    const info = await transporter.sendMail({
      from: `"GCES Kaveri Hostel Admin" <${smtpFrom}>`,
      to,
      subject,
      text,
      html
    });

    console.log(`[Mailer] OTP email successfully sent to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to ${to}:`, err);

    let userFriendlyError = 'Unable to send OTP email. Please try again.';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      userFriendlyError = 'SMTP Authentication failed. Invalid email or App Password configured on server.';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
      userFriendlyError = 'Email server connection timed out. Please try again.';
    } else if (err.message) {
      userFriendlyError = `Unable to send OTP: ${err.message}`;
    }

    return {
      success: false,
      error: userFriendlyError
    };
  }
}

module.exports = { sendEmail };
