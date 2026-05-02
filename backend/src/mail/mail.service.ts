import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sgMail from '@sendgrid/mail';

@Injectable()
export class MailService {
	constructor(private readonly configService: ConfigService) {
		const key = this.configService.get<string>('SENDGRID_API_KEY')?.trim();
		const from = this.configService.get<string>('MAIL_FROM')?.trim();
		if (!key) {
			throw new Error(
				'SENDGRID_API_KEY is required for outgoing mail (SendGrid Web API).',
			);
		}
		if (!from) {
			throw new Error(
				'MAIL_FROM is required (verified sender in SendGrid).',
			);
		}
		sgMail.setApiKey(key);
	}

	async sendEmailVerification(to: string, verificationUrl: string) {
		const subject = 'Подтвердите email';
		const text = `Перейдите по ссылке для подтверждения email: ${verificationUrl}`;
		const html = this.getEmailVerificationHtmlTemplate(verificationUrl);

		return this.sendOutgoing(to, subject, text, html);
	}

	async sendPasswordReset(to: string, resetUrl: string) {
		const subject = 'Сброс пароля';
		const text = `Перейдите по ссылке для сброса пароля: ${resetUrl}`;
		const html = this.getResetPasswordHtmlTemplate(resetUrl);

		return this.sendOutgoing(to, subject, text, html);
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

		return this.sendOutgoing(to, subject, text, html);
	}

	private getMailFrom(): string {
		const from = this.configService.get<string>('MAIL_FROM')?.trim();
		if (!from) {
			throw new Error('MAIL_FROM must be set for outgoing mail.');
		}
		return from;
	}

	private async sendOutgoing(
		to: string,
		subject: string,
		text: string,
		html: string,
	) {
		await sgMail.send({
			to,
			from: this.getMailFrom(),
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
