const nodemailer = require('nodemailer');

function getCleanEnv(key, defaultVal = '') {
  const val = process.env[key] || defaultVal;
  return String(val).trim().replace(/^["']|["']$/g, '');
}

async function sendEmail({ to, subject, text, html }) {
  const smtpUser = getCleanEnv('SMTP_USER') || getCleanEnv('EMAIL_USER');
  const smtpPass = getCleanEnv('SMTP_PASS') || getCleanEnv('EMAIL_PASS');
  const smtpHost = getCleanEnv('SMTP_HOST', 'smtp.gmail.com');
  const smtpPort = Number(getCleanEnv('SMTP_PORT', '587'));

  if (!smtpUser || !smtpPass) {
    console.error('[Mailer Error] Missing SMTP_USER or SMTP_PASS environment variables.');
    return {
      success: false,
      error: 'Unable to send OTP. Email service is not configured on the server. Please add SMTP_USER and SMTP_PASS to environment variables.'
    };
  }

  const transporterConfig = {
    host: smtpHost || 'smtp.gmail.com',
    port: isNaN(smtpPort) ? 587 : smtpPort,
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

    console.log(`[Mailer] OTP email successfully sent to ${to} via ${smtpUser} (Message ID: ${info.messageId})`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to ${to}:`, err);

    let userFriendlyError = 'Unable to send OTP. Please try again later.';
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      userFriendlyError = 'SMTP Authentication failed. Please check the Gmail address (SMTP_USER) and 16-character App Password (SMTP_PASS) in Render environment settings.';
    } else if (err.code === 'ESOCKET' || err.code === 'ETIMEDOUT') {
      userFriendlyError = 'Email server connection timed out. Please try again later.';
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
