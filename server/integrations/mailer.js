import nodemailer from "nodemailer";

/**
 * Thin wrapper around nodemailer so the rest of the app only depends on
 * `sendMail({ to, subject, html, text })`. Returns `null` when SMTP isn't
 * configured (e.g. no Mailtrap credentials in `.env` yet) so callers can
 * treat mail sending as best-effort instead of a hard dependency.
 */
export function createMailer({ host, port, user, pass, from }) {
  if (!host) return null;

  const transporter = nodemailer.createTransport({
    host,
    port,
    auth: user ? { user, pass } : undefined,
  });

  return {
    async sendMail({ to, subject, html, text }) {
      await transporter.sendMail({ from, to, subject, html, text });
    },
  };
}

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="font-family: Arial, sans-serif; background: #f4f5f7; padding: 24px;">
    <div style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 8px; padding: 32px;">
      <h1 style="font-size: 20px; color: #0877ff; margin: 0 0 16px;">SteamTwo</h1>
      <h2 style="font-size: 16px; margin: 0 0 16px;">${title}</h2>
      ${bodyHtml}
      <p style="font-size: 12px; color: #8c949e; margin-top: 32px;">Se você não pediu isso, pode ignorar este e-mail com segurança.</p>
    </div>
  </body></html>`;
}

export function verificationEmail({ username, link }) {
  return {
    subject: "Confirme seu e-mail na SteamTwo",
    text: `Olá, ${username}! Confirme seu e-mail acessando: ${link}`,
    html: layout("Confirme seu e-mail", `
      <p>Olá, <strong>${username}</strong>!</p>
      <p>Confirme seu endereço de e-mail para validar sua conta na SteamTwo.</p>
      <p><a href="${link}" style="display:inline-block;background:#0877ff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;">Confirmar e-mail</a></p>
      <p style="font-size:12px;color:#8c949e;">Ou copie e cole este link: ${link}</p>
    `),
  };
}

export function passwordResetEmail({ username, link }) {
  return {
    subject: "Redefinir sua senha na SteamTwo",
    text: `Olá, ${username}! Redefina sua senha acessando: ${link}`,
    html: layout("Redefinir senha", `
      <p>Olá, <strong>${username}</strong>!</p>
      <p>Recebemos um pedido para redefinir a senha da sua conta. Este link expira em 1 hora.</p>
      <p><a href="${link}" style="display:inline-block;background:#0877ff;color:#fff;text-decoration:none;padding:10px 20px;border-radius:6px;">Redefinir senha</a></p>
      <p style="font-size:12px;color:#8c949e;">Ou copie e cole este link: ${link}</p>
    `),
  };
}
