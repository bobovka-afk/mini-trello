import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
	constructor(private readonly mailerService: MailerService) {}

	private getEmailVerificationHtmlTemplate(verificationUrl: string): string {
		return `
      <p>Для подтверждения email нажмите <a href="${verificationUrl}">сюда</a>.</p>
      <p>Если вы не запрашивали это письмо, проигнорируйте его.</p>
    `;
	}

	private getResetPasswordHtmlTemplate(resetUrl: string): string {
		return `
      <p>Для сброса пароля нажмите <a href="${resetUrl}">сюда</a>.</p>
      <p>Если вы не запрашивали сброс пароля, проигнорируйте это письмо.</p>
    `;
	}

	async sendEmailVerification(to: string, verificationUrl: string) {
		const subject = 'Подтвердите email';
		const text = `Перейдите по ссылке для подтверждения email: ${verificationUrl}`;
		const html = this.getEmailVerificationHtmlTemplate(verificationUrl);

		return this.mailerService.sendMail({
			to,
			subject,
			text,
			html,
		});
	}

	async sendPasswordReset(to: string, resetUrl: string) {
		const subject = 'Сброс пароля';
		const text = `Перейдите по ссылке для сброса пароля: ${resetUrl}`;
		const html = this.getResetPasswordHtmlTemplate(resetUrl);

		return this.mailerService.sendMail({
			to,
			subject,
			text,
			html,
		});
	}
}

