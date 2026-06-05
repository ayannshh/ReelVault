const nodemailer = require("nodemailer");

function hasSmtpConfig() {
    return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT);
}

function createTransport() {
    const auth =
        process.env.SMTP_USER && process.env.SMTP_PASS
            ? {
                  user: process.env.SMTP_USER,
                  pass: process.env.SMTP_PASS,
              }
            : undefined;

    return nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === "true",
        auth,
    });
}

async function sendPasswordOtp(to, otp, username) {
    if (!hasSmtpConfig()) {
        console.log(`ReelVault password reset OTP for ${to}: ${otp}`);
        return { sent: false };
    }

    const transporter = createTransport();
    const from =
        process.env.MAIL_FROM ||
        process.env.SMTP_USER ||
        "ReelVault <no-reply@reelvault.local>";

    await transporter.sendMail({
        from,
        to,
        subject: "Your ReelVault password reset OTP",
        text: `Hi ${username}, your ReelVault password reset OTP is ${otp}. It expires in 10 minutes.`,
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.5;">
                <h2>ReelVault password reset</h2>
                <p>Hi ${username},</p>
                <p>Your password reset OTP is:</p>
                <p style="font-size: 28px; font-weight: 700; letter-spacing: 4px;">${otp}</p>
                <p>This OTP expires in 10 minutes.</p>
            </div>
        `,
    });

    return { sent: true };
}

module.exports = { sendPasswordOtp };
