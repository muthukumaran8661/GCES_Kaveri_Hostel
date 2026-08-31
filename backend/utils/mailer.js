const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error('[Mailer Error] Missing SMTP_USER or SMTP_PASS environment variables.');
    return {
      success: false,
      error: 'Unable to send OTP. Email service is not configured on the server. Please add SMTP_USER and SMTP_PASS to environment variables.'
    };
  }

  const transporterConfig = {
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT || 587),
    secure: false,
    auth: {
      user: smtpUser,
      pass: smtpPass
    },
    tls: {
      rejectUnauthorized: false
    }
  };

  try {
    const transporter = nodemailer.createTransport(transporterConfig);

    const info = await transporter.sendMail({
      from: `"GCES Kaveri Hostel Admin" <${smtpUser}>`,
      to,
      subject,
      text,
      html
    });

    console.log(`[Mailer] OTP email successfully sent to ${to} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to ${to}:`, err.message);

    let userFriendlyError = 'Unable to send OTP. Please try again later.';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      userFriendlyError = 'SMTP Authentication failed. Please check the Gmail address and 16-character App Password in Render settings.';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
      userFriendlyError = 'Email server connection timed out. Please try again later.';
    }

    return {
      success: false,
      error: userFriendlyError
    };
  }
}

module.exports = { sendEmail };
