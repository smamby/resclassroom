const EmailService = require('../emailService');

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'x' });

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

describe('EmailService.sendDeleteAccountEmail', () => {
  test('builds mail with delete url', async () => {
    const service = new EmailService();
    await service.sendDeleteAccountEmail('ana@mail.com', 'http://localhost:3000/delete-account/abc');
    expect(mockSendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ana@mail.com',
      subject: expect.stringContaining('borrado de cuenta'),
      html: expect.stringContaining('http://localhost:3000/delete-account/abc')
    }));
  });
});
