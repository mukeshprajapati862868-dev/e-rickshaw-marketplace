const nodemailer = require('nodemailer');
const config = require('../config');
const logger = require('../utils/logger');

let transporter = null;
let transporterReady = false;

/**
 * Real email delivery for OTP.
 * Supports:
 *  1. Gmail SMTP (service: gmail + App Password)  ← easiest
 *  2. Any SMTP host (host/port/user/pass)
 *  3. Resend API (RESEND_API_KEY)
 *
 * If nothing configured → DEV console print only.
 */
const initTransporter = async () => {
  if (transporter && transporterReady) return transporter;

  const provider = (config.email.provider || 'smtp').toLowerCase();
  const user = config.email.smtp?.auth?.user;
  const pass = config.email.smtp?.auth?.pass;
  const host = config.email.smtp?.host;

  // --- Resend ---
  if (provider === 'resend' && config.email.resendApiKey) {
    transporter = nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: config.email.resendApiKey,
      },
    });
    transporterReady = true;
    logger.info('Email: Resend SMTP ready');
    return transporter;
  }

  // --- Gmail (recommended) ---
  // Set SMTP_USER=your@gmail.com and SMTP_PASS=16-char App Password
  // SMTP_HOST can be empty or smtp.gmail.com
  if (user && pass && (!host || host.includes('gmail'))) {
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user,
        pass, // Gmail App Password (NOT normal password)
      },
    });
    try {
      await transporter.verify();
      transporterReady = true;
      logger.info(`Email: Gmail SMTP ready (${user})`);
    } catch (err) {
      logger.error(`Gmail SMTP verify failed: ${err.message}`);
      logger.error('Use Gmail App Password: https://myaccount.google.com/apppasswords');
      transporterReady = false;
      transporter = null;
    }
    if (transporterReady) return transporter;
  }

  // --- Generic SMTP ---
  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port: config.email.smtp.port || 587,
      secure: config.email.smtp.secure === true || config.email.smtp.port === 465,
      auth: { user, pass },
    });
    try {
      await transporter.verify();
      transporterReady = true;
      logger.info(`Email: SMTP ready (${host})`);
    } catch (err) {
      logger.error(`SMTP verify failed: ${err.message}`);
      transporterReady = false;
      transporter = null;
    }
    if (transporterReady) return transporter;
  }

  // --- Dev fallback (no credentials) ---
  logger.warn(
    'SMTP not configured. OTP will only print in console. Set SMTP_USER + SMTP_PASS in .env for real email.'
  );
  transporter = {
    sendMail: async (opts) => {
      const match = (opts.text || '').match(/\b(\d{6})\b/);
      const otpCode = match ? match[1] : '******';
      console.log('\n========================================');
      console.log('  e-riksha OTP (NO SMTP — CONSOLE ONLY)');
      console.log('========================================');
      console.log(`  To   : ${opts.to}`);
      console.log(`  OTP  : ${otpCode}`);
      console.log('  Valid: 5 minutes');
      console.log('  Tip  : Add Gmail App Password in .env to send real mail');
      console.log('========================================\n');
      return { messageId: 'dev-' + Date.now() };
    },
  };
  transporterReady = true;
  return transporter;
};

const sendOTPEmail = async (to, otp) => {
  const transport = await initTransporter();

  const fromAddress =
    config.email.from ||
    (config.email.smtp?.auth?.user
      ? `e-riksha <${config.email.smtp.auth.user}>`
      : 'e-riksha <noreply@eriksha.local>');

  const subject = 'Your e-riksha Verification Code';
  const text = `Your verification code is:

${otp}

Use this OTP to verify your email address and continue signing in.

OTP valid for 5 minutes.
Do not share this OTP with anyone.

If you did not request this code, ignore this email.

— e-riksha`;

  const html = `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:440px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
        <tr>
          <td style="background:#1d4ed8;padding:20px 24px;text-align:center;">
            <span style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">e-riksha</span>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px;">
            <p style="margin:0 0 8px;color:#64748b;font-size:14px;">Your verification code</p>
            <p style="margin:0 0 20px;font-size:36px;font-weight:bold;letter-spacing:10px;color:#0f172a;text-align:center;">${otp}</p>
            <p style="margin:0 0 8px;color:#475569;font-size:14px;line-height:1.5;">
              Use this OTP to verify your email and continue signing in on <strong>e-riksha</strong>.
            </p>
            <p style="margin:0;color:#64748b;font-size:13px;">
              <strong>Valid for 5 minutes.</strong> Do not share this code with anyone.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;">
            <p style="margin:0;color:#94a3b8;font-size:11px;text-align:center;">
              If you did not request this code, you can ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    const info = await transport.sendMail({
      from: fromAddress,
      to,
      subject,
      text,
      html,
    });

    // Real SMTP success
    if (info.messageId && !String(info.messageId).startsWith('dev-')) {
      console.log(`\n✓ OTP email sent to ${to} (messageId: ${info.messageId})\n`);
      logger.info(`OTP email sent to ${to}`);
    }
    return true;
  } catch (err) {
    logger.error('Failed to send OTP email', { error: err.message, to });

    // Always show OTP in console so login is not blocked during setup
    console.log('\n========================================');
    console.log('  e-riksha OTP (EMAIL SEND FAILED)');
    console.log('========================================');
    console.log(`  To   : ${to}`);
    console.log(`  OTP  : ${otp}`);
    console.log(`  Error: ${err.message}`);
    console.log('  Fix  : Check SMTP_USER / SMTP_PASS (Gmail App Password)');
    console.log('========================================\n');

    if (config.env === 'production') {
      throw new Error('Failed to send verification email. Please try again later.');
    }
    // Dev: allow continue with console OTP
    return true;
  }
};

/** Call once on server start to log email status */
const warmEmail = async () => {
  try {
    await initTransporter();
  } catch (e) {
    logger.warn('Email warm-up: ' + e.message);
  }
};

module.exports = {
  sendOTPEmail,
  initTransporter,
  warmEmail,
};
