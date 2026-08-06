import nodemailer from "nodemailer";

const escapeHtml = (value = "") =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

const getTransporter = () => {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV !== "production") {
      return null;
    }

    throw new Error(
      "SMTP configuration missing. Define SMTP_HOST, SMTP_PORT, SMTP_USER and SMTP_PASS in .env"
    );
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass }
  });
};

const sendOrLogEmail = async ({ to, subject, text, html, devLink }) => {
  const transporter = getTransporter();

  if (!transporter) {
    console.warn(`[Email dev] SMTP no configurado. Enlace generado para ${to}: ${devLink}`);
    return { skipped: true, devLink };
  }

  const fromAddress = process.env.EMAIL_FROM || '"Los Rubios Rojos" <no-reply@losrubiosrojos.com>';
  return transporter.sendMail({
    from: fromAddress,
    to,
    subject,
    text,
    html
  });
};

export const sendVerificationEmail = async (user, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const verifyLink = `${frontendUrl}/verify-email?token=${encodeURIComponent(token)}`;
  const safeUsername = escapeHtml(user.username);
  const safeVerifyLink = escapeHtml(verifyLink);

  const html = `
    <div style="margin:0;padding:0;background:#120b09;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#120b09;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:700px;background:#fffaf0;border-radius:20px;overflow:hidden;border:1px solid #f2c36b;box-shadow:0 22px 70px rgba(0,0,0,.28);">
              <tr>
                <td style="background:#a91010;padding:0;color:#fff8ec;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="padding:30px 30px 26px;">
                        <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#ffd87a;">Los Rubios Rojos</div>
                        <h1 style="margin:12px 0 0;font-size:36px;line-height:1.05;font-weight:900;">Tu pase a la cocina digital</h1>
                        <p style="margin:14px 0 0;font-size:16px;line-height:1.65;color:#ffe8bd;">Confirma tu correo para activar reservas, pedidos y herramientas segun tu rol.</p>
                      </td>
                      <td width="132" align="center" style="padding:20px 24px 20px 0;">
                        <div style="width:104px;height:104px;border-radius:50%;background:#ffd87a;color:#7d1212;border:7px solid #fff2c8;text-align:center;font-weight:900;line-height:1;">
                          <div style="font-size:32px;padding-top:22px;">RR</div>
                          <div style="font-size:10px;letter-spacing:2px;margin-top:7px;">TICKET</div>
                        </div>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px;">
                  <div style="height:18px;background:repeating-linear-gradient(90deg,#f7b731 0,#f7b731 16px,#fff8ec 16px,#fff8ec 30px,#cf2f2a 30px,#cf2f2a 36px);border-radius:0 0 16px 16px;"></div>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 28px 10px;color:#291817;">
                  <p style="margin:0 0 18px;font-size:18px;line-height:1.65;">Hola <strong>${safeUsername}</strong>,</p>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#4b2a25;">
                    Tu cuenta ya esta creada. Solo falta sellar este ticket para activar pedidos, reservas y administracion segun tu rol.
                  </p>

                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:separate;border-spacing:0;">
                    <tr>
                      <td style="background:#fff;border:2px dashed #d0362d;border-radius:16px;padding:20px;">
                        <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#9d2a22;font-weight:800;">Ticket de verificacion</div>
                        <div style="margin-top:8px;font-size:15px;color:#51312c;">Valido por 60 minutos</div>
                        <div style="margin-top:14px;height:1px;background:repeating-linear-gradient(90deg,#e7b163 0,#e7b163 10px,transparent 10px,transparent 18px);"></div>
                        <div style="margin-top:18px;text-align:center;">
                          <a href="${safeVerifyLink}" style="display:inline-block;background:#17386c;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 30px;border-radius:999px;border:3px solid #0f264a;">
                            Verificar mi correo
                          </a>
                        </div>
                      </td>
                    </tr>
                  </table>

                  <p style="margin:22px 0 8px;font-size:14px;color:#6a4943;">Si el boton no abre, copia este enlace:</p>
                  <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.6;color:#1f4e97;">${safeVerifyLink}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 28px 30px;">
                  <div style="background:#2a1714;color:#ffe7b4;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.55;border-left:5px solid #f7b731;">
                    Si no solicitaste esta cuenta, puedes ignorar este correo. Nadie podra entrar sin verificar el enlace.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return sendOrLogEmail({
    to: user.email,
    subject: "Los Rubios Rojos - confirma tu correo",
    text: `Hola ${user.username},

Confirma tu correo para activar tu cuenta:
${verifyLink}

Este enlace expira en 60 minutos.

Los Rubios Rojos`,
    html,
    devLink: verifyLink
  });
};

export const sendAdminActivationEmail = async (user, token) => {
  const frontendUrl = process.env.FRONTEND_URL || "http://localhost:5173";
  const activationLink = `${frontendUrl}/activate-admin?token=${encodeURIComponent(token)}`;
  const safeUsername = escapeHtml(user.username);
  const safeActivationLink = escapeHtml(activationLink);

  const html = `
    <div style="margin:0;padding:0;background:#120b09;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#120b09;padding:28px 12px;font-family:Arial,Helvetica,sans-serif;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:680px;background:#fffaf0;border-radius:18px;overflow:hidden;border:1px solid #f2c36b;">
              <tr>
                <td style="background:#17386c;color:#fff;padding:28px;">
                  <div style="font-size:12px;letter-spacing:3px;text-transform:uppercase;font-weight:800;color:#ffd87a;">Los Rubios Rojos</div>
                  <h1 style="margin:12px 0 0;font-size:32px;line-height:1.1;">Activacion de rol administrador</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 28px;color:#291817;">
                  <p style="margin:0 0 16px;font-size:18px;line-height:1.6;">Hola <strong>${safeUsername}</strong>,</p>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.7;color:#4b2a25;">
                    Un administrador autorizo activar permisos de administracion para tu cuenta.
                    Confirma este enlace para completar el cambio de rol.
                  </p>
                  <div style="text-align:center;margin:28px 0;">
                    <a href="${safeActivationLink}" style="display:inline-block;background:#a91010;color:#ffffff;text-decoration:none;font-size:16px;font-weight:800;padding:15px 30px;border-radius:999px;">
                      Activar rol admin
                    </a>
                  </div>
                  <p style="margin:20px 0 8px;font-size:14px;color:#6a4943;">Si el boton no abre, copia este enlace:</p>
                  <p style="margin:0;word-break:break-all;font-size:13px;line-height:1.6;color:#1f4e97;">${safeActivationLink}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:0 28px 28px;">
                  <div style="background:#2a1714;color:#ffe7b4;border-radius:14px;padding:16px 18px;font-size:13px;line-height:1.55;border-left:5px solid #f7b731;">
                    Este enlace expira en 30 minutos. Si no solicitaste este acceso, ignora este correo.
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;

  return sendOrLogEmail({
    to: user.email,
    subject: "Los Rubios Rojos - activa tu rol admin",
    text: `Hola ${user.username},

Un administrador autorizo activar permisos de administracion para tu cuenta.
Confirma este enlace para completar el cambio de rol:
${activationLink}

Este enlace expira en 30 minutos.

Los Rubios Rojos`,
    html,
    devLink: activationLink
  });
};
