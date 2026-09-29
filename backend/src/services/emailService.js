const nodemailer = require('nodemailer');

const createTransporter = () => {
  if (process.env.MAIL_USER && process.env.MAIL_PASS) {
    const service = process.env.MAIL_SERVICE || 'gmail';
    return nodemailer.createTransport({
      service: service,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  // Fallback for development if no real credentials are provided
  console.log("No MAIL_USER or MAIL_PASS provided in .env, falling back to Ethereal");
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: 'test@ethereal.email', // Fixed to ensure we don't send real creds to Ethereal
      pass: 'testpass',
    },
  });
};

const sendDeletionEmail = async (email, username) => {
  try {
    const transporter = createTransporter();

    const mailOptions = {
      from: process.env.MAIL_USER || '"Nth Watch" <noreply@nthwatch.com>',
      to: email,
      subject: 'Your account has been deleted',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
          <h2 style="color: #E2430F;">Account Deleted</h2>
          <p>Hi ${username},</p>
          <p>Your account and all associated data have been permanently deleted.</p>
          <p>We're sorry to see you go! You are welcome back anytime.</p>
          <p>Regards,<br>The Nth Watch Team</p>
        </div>
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log("Email sent successfully. Message ID:", info.messageId);

    if (info.response && typeof info.response === 'string' && info.response.includes('ethereal')) {
        console.log('Preview URL: ' + nodemailer.getTestMessageUrl(info));
    }
  } catch (error) {
    console.error("Email sending failed:", error);
  }
};

module.exports = {
  sendDeletionEmail,
};
