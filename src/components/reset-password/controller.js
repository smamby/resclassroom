const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const ResetPasswordStore = require('./store');
const UserStore = require('../user/store');
const EmailService = require('./emailService');

const TOKEN_EXPIRY_MS = 20 * 60 * 1000;

class ResetPasswordController {
  constructor() {
    this.store = new ResetPasswordStore();
    this.userStore = new UserStore();
    this.emailService = new EmailService();
  }

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      if (!email) {
        return res.status(400).json({ error: 'Email es requerido' });
      }

      const user = await this.userStore.findByEmail(email);
      if (!user) {
        console.log('[RESET-PASSWORD] Solicitud para email no existente:', email);
        return res.status(200).json({
          message: 'Te hemos enviado un correo.'
        });
      }

      const token = crypto.randomBytes(20).toString('hex');
      const expires = Date.now() + TOKEN_EXPIRY_MS;

      await this.store.setResetToken(email, token, expires);

      const baseUrl = process.env.APP_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password/${token}`;

      try {
        await this.emailService.sendResetEmail(user.email, resetUrl);
      } catch (emailErr) {
        console.error('[RESET-PASSWORD] Error enviando email:', emailErr);
      }

      res.status(200).json({
        message: 'Te hemos enviado un correo.'
      });
    } catch (err) {
      console.error('[RESET-PASSWORD] Error:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }

  async resetPassword(req, res) {
    try {
      const { token } = req.params;
      const { password } = req.body;

      if (!token || !password) {
        return res.status(400).json({ error: 'Token y contraseña son requeridos' });
      }

      // if (password.length < 6) {
      //   return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
      // }

      const user = await this.store.findByToken(token);
      if (!user) {
        return res.status(400).json({ error: 'El token es inválido o ha expirado' });
      }

      const passwordHash = bcrypt.hashSync(password, 10);
      await this.store.updatePassword(user._id, passwordHash);

      res.status(200).json({ message: 'Contraseña actualizada correctamente' });
    } catch (err) {
      console.error('[RESET-PASSWORD] Error:', err);
      res.status(500).json({ error: 'Error interno' });
    }
  }
}

module.exports = ResetPasswordController;
