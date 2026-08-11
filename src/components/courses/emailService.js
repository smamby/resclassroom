const nodemailer = require('nodemailer');

// Emails del ciclo de cursos. Se desactivan en modo test (TEST_AUTH=1) y con
// COURSES_EMAIL_DISABLED=1. Los envíos son fire-and-forget: un fallo de SMTP no
// debe romper la operación (a diferencia del borrado de cuenta, acá el email es
// informativo y el resultado se ve dentro de la app).
class CoursesEmailService {
  constructor() {
    this.enabled = process.env.TEST_AUTH !== '1' && process.env.COURSES_EMAIL_DISABLED !== '1';
    if (this.enabled) {
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      });
      this.from = process.env.SMTP_FROM || process.env.SMTP_USER;
    }
  }

  async _send(to, subject, html) {
    if (!this.enabled || !to) return;
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
    } catch (err) {
      console.error('[COURSES] Email no enviado:', err.message);
    }
  }

  // A un miembro SUBCO: propuesta nueva o re-editada (para re-votar).
  sendVoteRequest(to, courseTitle, voteUrl) {
    return this._send(
      to,
      `Votación pendiente: ${courseTitle}`,
      `<h1>${courseTitle}</h1><p>Tenés una votación pendiente en la SUBCO.</p>` +
      `<p><a href="${voteUrl}" style="padding:12px 24px;background:#4A90D9;color:white;text-decoration:none;border-radius:4px;">Ir a votar</a></p>` +
      `<p style="color:#666;font-size:0.9em;">${voteUrl}</p>`
    );
  }

  sendApproved(to, courseTitle, summary) {
    return this._send(
      to,
      `Curso aprobado: ${courseTitle}`,
      `<h1>${courseTitle} fue aprobado</h1><p>${summary}</p>`
    );
  }

  sendRejected(to, courseTitle) {
    return this._send(
      to,
      `Curso rechazado: ${courseTitle}`,
      `<h1>${courseTitle} no alcanzó la aprobación</h1>` +
      `<p>Podés volverlo a borrador desde la app para corregirlo.</p>`
    );
  }
}

module.exports = CoursesEmailService;
