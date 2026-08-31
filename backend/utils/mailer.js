const nodemailer = require('nodemailer');

async function sendEmail({ to, subject, text, html }) {
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (smtpHost && smtpUser && smtpPass) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass
        }
      });

      const info = await transporter.sendMail({
        from: `"GCES Kaveri Hostel Admin" <${process.env.SMTP_FROM || smtpUser}>`,
        to,
        subject,
        text,
        html
      });
      console.log(`[Mailer] Email sent to ${to}: ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[Mailer Error] Failed to send email to ${to}:`, err.message);
      return { success: false, error: err.message };
    }
  } else {
    console.log(`[Mailer Simulation] Email to: ${to} | Subject: ${subject}`);
    console.log(`[Mailer Simulation] Content:\n${text}`);
    return { success: true, simulated: true };
  }
}

module.exports = { sendEmail };
