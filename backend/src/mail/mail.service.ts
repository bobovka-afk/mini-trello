import { Injectable } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';

@Injectable()
export class MailService {
	constructor(private readonly mailerService: MailerService) {}

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

	async sendWorkspaceInvite(
		to: string,
		inviteUrl: string,
		workspaceName: string,
	) {
		const subject = 'Приглашение в рабочее пространство';
		const namePlain = workspaceName.trim() || 'рабочее пространство';
		const nameHtml = this.escapeHtml(namePlain);
		const text = `Вас пригласили присоединиться к рабочему пространству «${namePlain}».\n\nЧтобы принять приглашение, откройте ссылку в браузере:\n${inviteUrl}`;
		const html = this.getWorkspaceInviteHtmlTemplate(inviteUrl, nameHtml);

		return this.mailerService.sendMail({
			to,
			subject,
			text,
			html,
		});
	}

	private escapeHtml(s: string): string {
		return s
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;');
	}

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

	private getWorkspaceInviteHtmlTemplate(
		inviteUrl: string,
		workspaceNameEscaped: string,
	): string {
		const btn =
			'display:inline-block;padding:8px 16px;background:#2563eb;color:#ffffff !important;' +
			'text-decoration:none;border-radius:6px;font:600 14px/1.3 system-ui,-apple-system,sans-serif;';
		return `
      <p style="margin:0 0 16px;font:16px/1.5 system-ui,-apple-system,sans-serif;color:#111;">
        Вас пригласили присоединиться к рабочему пространству «${workspaceNameEscaped}».
      </p>
      <p style="margin:0;">
        <a href="${inviteUrl}" style="${btn}">Принять приглашение</a>
      </p>
    `;
	}
}

