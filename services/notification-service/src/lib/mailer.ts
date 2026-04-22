import nodemailer from 'nodemailer';
import { logger } from '@lms/logger';

// Cau hinh transporter
// Uu tien dung real SMTP neu co bien moi truong, neu khong dung console (mock) hoac Ethereal.
const host = process.env.SMTP_HOST || 'smtp.ethereal.email';
const port = parseInt(process.env.SMTP_PORT || '587', 10);
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure: port === 465, // true for 465, false for other ports
  auth: user && pass ? { user, pass } : undefined,
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  const from = process.env.SMTP_FROM || 'LMS Platform <noreply@lms.local>';
  
  if (!user || !pass) {
    logger.warn({ to, subject }, 'No SMTP_USER/PASS provided, skipping real email send. Logging output instead.');
    logger.info(`[MOCK EMAIL to ${to}] Subject: ${subject}`);
    return;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      html,
    });
    logger.info({ messageId: info.messageId, to }, 'Email sent successfully via SMTP');
  } catch (err) {
    logger.error({ err, to }, 'Failed to send email via SMTP');
    throw err;
  }
};

// --- Email Templates ---

export const getPaymentSuccessTemplate = (name: string, amount: number, currency: string, orderId: string) => `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #10b981;">Thanh toán thành công!</h2>
  <p>Chào <strong>${name}</strong>,</p>
  <p>Cảm ơn bạn đã mua khóa học trên hệ thống LMS. Đơn hàng của bạn đã được thanh toán thành công.</p>
  <ul>
    <li><strong>Mã đơn hàng:</strong> ${orderId}</li>
    <li><strong>Số tiền:</strong> ${amount.toLocaleString('vi-VN')} ${currency}</li>
  </ul>
  <p>Bạn đã có thể bắt đầu học tập ngay bây giờ.</p>
  <br/>
  <p>Trân trọng,<br/>Đội ngũ LMS</p>
</div>
`;

export const getEnrollmentCreatedTemplate = (name: string, courseName: string = 'khóa học mới') => `
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #333;">
  <h2 style="color: #3b82f6;">Ghi danh thành công!</h2>
  <p>Chào <strong>${name}</strong>,</p>
  <p>Chúc mừng bạn đã được ghi danh thành công vào ${courseName}.</p>
  <p>Đăng nhập vào hệ thống và truy cập phần <strong>"Học của tôi"</strong> để bắt đầu hành trình cải thiện kỹ năng của bạn.</p>
  <br/>
  <p>Chúc bạn học tốt,<br/>Đội ngũ LMS</p>
</div>
`;
