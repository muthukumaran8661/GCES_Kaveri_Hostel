const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const smtpService = process.env.SMTP_SERVICE;
  const smtpHost = process.env.SMTP_HOST || (smtpService ? undefined : 'smtp.gmail.com');
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.error('[Mailer Error] Missing SMTP_USER or SMTP_PASS environment variables.');
    return {
      success: false,
      error: 'Unable to send OTP. Email service is not configured on the server. Please configure SMTP credentials in environment variables.'
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
      }
    };
  }

  try {
    const transporter = nodemailer.createTransport(transporterConfig);
    const info = await transporter.sendMail({
      from: `"GCES Kaveri Hostel Admin" <${process.env.SMTP_FROM || smtpUser}>`,
      to,
      subject,
      text,
      html
    });
    console.log(`[Mailer] Real email successfully sent to ${to}: ${info.messageId}`);
    return { success: true, messageId: info.messageId };
  } catch (err) {
    console.error(`[Mailer Error] Failed to send email to ${to}:`, err.message);
    return {
      success: false,
      error: `Unable to send OTP: ${err.message}`
    };
  }
}

module.exports = { sendEmail };
