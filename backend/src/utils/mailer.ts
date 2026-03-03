import nodemailer from "nodemailer";
import { env } from "../env";

let cachedTransporter: nodemailer.Transporter | null = null;
let checked = false;

const SMTP_CONNECTION_TIMEOUT_MS = 10000;
const SMTP_GREETING_TIMEOUT_MS = 10000;
const SMTP_SOCKET_TIMEOUT_MS = 20000;
const SMTP_SEND_TIMEOUT_MS = 20000;
const RESEND_SEND_TIMEOUT_MS = 20000;

type MailContent = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

function getTransporter() {
  if (checked) return cachedTransporter;
  checked = true;

  if (!env.SMTP_HOST || !env.SMTP_USER || !env.SMTP_PASS) {
    cachedTransporter = null;
    return cachedTransporter;
  }

  cachedTransporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });

  return cachedTransporter;
}

function fromAddress() {
  const fromEmail = env.SMTP_FROM_EMAIL || env.SMTP_USER;
  return `"${env.SMTP_FROM_NAME}" <${fromEmail}>`;
}

function normalizeSmtpError(err: any) {
  const code = String(err?.code ?? "");
  if (code === "ENETUNREACH" || code === "EHOSTUNREACH") {
    return new Error(
      "Server tidak bisa menjangkau SMTP host. Gunakan IPv4 (set SMTP_FAMILY=4) lalu deploy ulang backend.",
    );
  }
  if (code === "ECONNREFUSED" || code === "ETIMEDOUT") {
    return new Error("Koneksi ke SMTP gagal/timeout. Cek SMTP_HOST, SMTP_PORT, dan firewall provider.");
  }
  if (code === "EAUTH") {
    return new Error("Autentikasi SMTP gagal. Cek SMTP_USER dan SMTP_PASS (app password).");
  }
  if (err instanceof Error) return err;
  return new Error("Gagal mengirim email via SMTP.");
}

async function sendMailWithTimeout(
  transporter: nodemailer.Transporter,
  options: nodemailer.SendMailOptions,
) {
  let timeoutId: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error("Koneksi SMTP timeout. Coba lagi beberapa saat."));
    }, SMTP_SEND_TIMEOUT_MS);
  });

  try {
    await Promise.race([transporter.sendMail(options), timeoutPromise]);
  } catch (err) {
    throw normalizeSmtpError(err);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

function getMailProvider() {
  const configured = String(env.EMAIL_PROVIDER ?? "auto").trim().toLowerCase();
  if (configured === "smtp" || configured === "resend") return configured;
  if (env.RESEND_API_KEY) return "resend";
  return "smtp";
}

function fromEmailForApi() {
  const fromEmail = (env.SMTP_FROM_EMAIL || env.SMTP_USER || "").trim();
  if (fromEmail) return fromEmail;
  return "onboarding@resend.dev";
}

async function sendViaResend(input: MailContent) {
  const apiKey = String(env.RESEND_API_KEY ?? "").trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY belum diisi.");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), RESEND_SEND_TIMEOUT_MS);

  try {
    const res = await fetch(env.RESEND_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `"${env.SMTP_FROM_NAME}" <${fromEmailForApi()}>`,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        text: input.text,
      }),
      signal: controller.signal,
    });

    let data: any = {};
    try {
      data = await res.json();
    } catch {
      data = {};
    }

    if (!res.ok) {
      const apiMessage =
        data?.message ||
        data?.error?.message ||
        data?.error ||
        `Resend API gagal (${res.status})`;
      throw new Error(String(apiMessage));
    }
  } catch (err: any) {
    if (err?.name === "AbortError") {
      throw new Error("Koneksi ke provider email timeout. Coba lagi beberapa saat.");
    }
    if (err instanceof Error) throw err;
    throw new Error("Gagal mengirim email via Resend.");
  } finally {
    clearTimeout(timeoutId);
  }
}

async function sendEmail(input: MailContent) {
  const provider = getMailProvider();

  if (provider === "resend") {
    await sendViaResend(input);
    return;
  }

  const transporter = getTransporter();
  if (!transporter) {
    throw new Error(
      "SMTP belum dikonfigurasi. Isi SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, dan SMTP_FROM_EMAIL di backend/.env",
    );
  }

  await sendMailWithTimeout(transporter, {
    from: fromAddress(),
    to: input.to,
    subject: input.subject,
    text: input.text,
    html: input.html,
  });
}

export async function sendRegisterVerificationCodeEmail(input: {
  to: string;
  code: string;
  expiresInMinutes: number;
}) {
  const brandName = env.SMTP_FROM_NAME || "OTP Seller";
  const nowYear = new Date().getFullYear();

  const subject = `Kode Verifikasi ${brandName}`;
  const text = [
    `${brandName} - Verifikasi Email Registrasi`,
    "",
    `Kode verifikasi Anda: ${input.code}`,
    `Berlaku selama ${input.expiresInMinutes} menit.`,
    "",
    "Jangan bagikan kode ini ke siapa pun.",
    "Abaikan email ini jika Anda tidak merasa mendaftar.",
  ].join("\n");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
          Kode verifikasi ${brandName}: ${input.code}
        </span>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f1f5f9;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#0f766e,#14b8a6);padding:24px;">
                    <div style="font-size:12px;letter-spacing:1.2px;color:#ccfbf1;text-transform:uppercase;font-weight:700;">
                      Verifikasi Registrasi
                    </div>
                    <div style="margin-top:6px;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">
                      Selamat datang di ${brandName}
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155;">
                      Gunakan kode berikut untuk menyelesaikan pendaftaran akun:
                    </p>

                    <div style="margin:18px 0;padding:16px;border-radius:12px;border:1px dashed #14b8a6;background:#f0fdfa;text-align:center;">
                      <span style="display:inline-block;font-size:34px;line-height:1;font-weight:800;letter-spacing:8px;color:#0f766e;">
                        ${input.code}
                      </span>
                    </div>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;border:1px solid #e2e8f0;border-radius:10px;">
                      <tr>
                        <td style="padding:12px 14px;font-size:13px;line-height:1.6;color:#475569;">
                          Kode ini berlaku selama <strong>${input.expiresInMinutes} menit</strong>.
                          Jangan bagikan kode kepada siapa pun, termasuk pihak yang mengaku dari ${brandName}.
                        </td>
                      </tr>
                    </table>

                    <p style="margin:18px 0 0;font-size:13px;line-height:1.6;color:#64748b;">
                      Jika Anda tidak merasa melakukan pendaftaran, abaikan email ini dengan aman.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                      ${brandName} • ${nowYear}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();

  await sendEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}

export async function sendPasswordResetLinkEmail(input: {
  to: string;
  resetUrl: string;
  expiresInMinutes: number;
}) {
  const brandName = env.SMTP_FROM_NAME || "OTP Seller";
  const nowYear = new Date().getFullYear();

  const subject = `Link Reset Password ${brandName}`;
  const text = [
    `${brandName} - Reset Password`,
    "",
    "Klik link berikut untuk membuat password baru:",
    input.resetUrl,
    "",
    `Berlaku selama ${input.expiresInMinutes} menit.`,
    "",
    "Jika Anda tidak meminta reset password, abaikan email ini.",
    "Jangan bagikan link ini ke siapa pun.",
  ].join("\n");
  const html = `
    <!doctype html>
    <html>
      <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>${subject}</title>
      </head>
      <body style="margin:0;padding:0;background-color:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">
        <span style="display:none;visibility:hidden;opacity:0;height:0;width:0;overflow:hidden;">
          Link reset password untuk akun ${brandName}
        </span>

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color:#f8fafc;padding:24px 12px;">
          <tr>
            <td align="center">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:560px;background:#ffffff;border:1px solid #e2e8f0;border-radius:16px;overflow:hidden;">
                <tr>
                  <td style="background:linear-gradient(135deg,#0f172a,#334155);padding:24px;">
                    <div style="font-size:12px;letter-spacing:1.2px;color:#cbd5e1;text-transform:uppercase;font-weight:700;">
                      Keamanan Akun
                    </div>
                    <div style="margin-top:6px;font-size:24px;line-height:1.3;color:#ffffff;font-weight:700;">
                      Permintaan Reset Password
                    </div>
                  </td>
                </tr>

                <tr>
                  <td style="padding:24px;">
                    <p style="margin:0 0 10px;font-size:15px;line-height:1.6;color:#334155;">
                      Klik tombol berikut untuk mengatur ulang password akun kamu:
                    </p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;">
                      <tr>
                        <td style="border-radius:12px;background:#0f172a;">
                          <a href="${input.resetUrl}" style="display:inline-block;padding:12px 18px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none;">
                            Buat Password Baru
                          </a>
                        </td>
                      </tr>
                    </table>

                    <p style="margin:0 0 12px;font-size:12px;line-height:1.6;color:#64748b;">
                      Jika tombol tidak berfungsi, salin link berikut ke browser:
                      <br />
                      <a href="${input.resetUrl}" style="color:#0f766e;word-break:break-all;">${input.resetUrl}</a>
                    </p>

                    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:6px;border:1px solid #e2e8f0;border-radius:10px;">
                      <tr>
                        <td style="padding:12px 14px;font-size:13px;line-height:1.6;color:#475569;">
                          Link ini berlaku selama <strong>${input.expiresInMinutes} menit</strong>.
                          Jika kamu tidak meminta reset password, abaikan email ini dan pastikan akun tetap aman.
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <tr>
                  <td style="padding:16px 24px;border-top:1px solid #e2e8f0;background:#f8fafc;">
                    <p style="margin:0;font-size:12px;line-height:1.6;color:#94a3b8;">
                      ${brandName} &bull; ${nowYear}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `.trim();

  await sendEmail({
    to: input.to,
    subject,
    text,
    html,
  });
}
