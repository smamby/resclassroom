const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail }))
}));

describe('CoursesEmailService', () => {
  beforeEach(() => mockSendMail.mockReset());

  test('envía solicitud de votación con link directo', async () => {
    process.env.TEST_AUTH = '';
    const EmailService = require('../emailService');
    const svc = new EmailService();
    await svc.sendVoteRequest('leo@mail.com', 'Escalada', 'http://localhost:3000/?votar=c1');
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    const args = mockSendMail.mock.calls[0][0];
    expect(args.to).toBe('leo@mail.com');
    expect(args.subject).toContain('Escalada');
    expect(args.html).toContain('http://localhost:3000/?votar=c1');
  });

  test('no envía nada en modo test (TEST_AUTH=1)', async () => {
    process.env.TEST_AUTH = '1';
    const EmailService = require('../emailService');
    const svc = new EmailService();
    await svc.sendVoteRequest('leo@mail.com', 'Escalada', 'url');
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  test('los fallos de SMTP no rompen la operación (fire-and-forget)', async () => {
    process.env.TEST_AUTH = '';
    mockSendMail.mockRejectedValue(new Error('SMTP down'));
    const EmailService = require('../emailService');
    const svc = new EmailService();
    await expect(svc.sendApproved('x@mail.com', 'Escalada', 'ok')).resolves.toBeUndefined();
  });
});
