const nodemailer = require('nodemailer');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
    this.from = process.env.SMTP_FROM || process.env.SMTP_USER;
  }

  async sendResetEmail(email, resetUrl) {
    const mailOptions = {
      from: this.from,
      to: email,
      subject: 'Recuperación de Contraseña - ReservaWorkspaces',
      html: `
        <h1>Recuperación de Contraseña</h1>
        <p>Has solicitado recuperar tu contraseña. Haz clic en el siguiente enlace:</p>
        <p><a href="${resetUrl}" style="padding: 12px 24px; background: #4A90D9; color: white; text-decoration: none; border-radius: 4px;">Cambiar mi contraseña</a></p>
        <p>O copia y pega este enlace en tu navegador:</p>
        <p>${resetUrl}</p>
        <p style="color: #666; font-size: 0.9em;">Este enlace caduca en 20 minutos.</p>
        <p style="color: #666; font-size: 0.9em;">Si no solicitaste este cambio, ignora este correo.</p>
      `
    };

    return this.transporter.sendMail(mailOptions);
  }
}

module.exports = EmailService;
