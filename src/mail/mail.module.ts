import { Module } from '@nestjs/common';
import { MailerModule } from '@nestjs-modules/mailer';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MailService } from './mail.service';

@Module({
	imports: [
		ConfigModule,
		MailerModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (configService: ConfigService) => {
				const get = (key: string, fallback = '') =>
					(configService.get<string>(key) || fallback).trim();
				const smtpUser = get('SMTP_USER') || get('EMAIL_USER');
				const smtpPass =
					get('SMTP_PASS').replace(/\s+/g, '') ||
					get('EMAIL_PASS').replace(/\s+/g, '');

				if (!smtpUser || !smtpPass) {
					throw new Error(
						'SMTP credentials are required. Set SMTP_USER/SMTP_PASS (or EMAIL_USER/EMAIL_PASS) in .env',
					);
				}

				const smtpHost = get('SMTP_HOST', 'smtp.gmail.com');
				const smtpPort = Number(get('SMTP_PORT', '465'));
				const smtpSecureValue = configService.get<string>('SMTP_SECURE');
				const smtpSecure =
					smtpSecureValue !== undefined ? smtpSecureValue === 'true' : smtpPort === 465;

				return {
					transport: {
						host: smtpHost,
						port: smtpPort,
						secure: smtpSecure,
						auth: {
							user: smtpUser,
							pass: smtpPass,
						},
					},
					defaults: {
						from: get('MAIL_FROM') || smtpUser || 'no-reply@localhost',
					},
				};
			},
		}),
	],
	providers: [MailService],
	exports: [MailService],
})
export class MailModule {}

