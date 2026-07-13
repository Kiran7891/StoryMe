import { type Database, schema } from '@storyme/database';
import { eq } from 'drizzle-orm';
import type { Logger } from 'pino';

export interface NotifyPayload {
  userId: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/** Delivers a notification over one or more channels. */
export interface Notifier {
  notify(payload: NotifyPayload): Promise<void>;
}

/** Sends push notifications through the Expo Push service. */
export class ExpoPushSender {
  constructor(private readonly logger: Logger) {}
  async send(tokens: string[], payload: NotifyPayload): Promise<void> {
    if (tokens.length === 0) return;
    const messages = tokens.map((to) => ({
      to,
      title: payload.title,
      body: payload.body,
      data: payload.data ?? {},
    }));
    const res = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });
    if (!res.ok) this.logger.warn({ status: res.status }, 'expo push send failed');
  }
}

/** Sends transactional email via Resend. */
export class ResendEmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly from: string,
    private readonly logger: Logger,
  ) {}
  async send(to: string, subject: string, html: string): Promise<void> {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: this.from, to, subject, html }),
    });
    if (!res.ok) this.logger.warn({ status: res.status }, 'resend email failed');
  }
}

/**
 * Fans a notification out to the user's registered devices (push) and, for
 * high-signal events, their email. Channels that aren't configured are skipped
 * gracefully so the pipeline never fails on delivery.
 */
export class ChannelNotifier implements Notifier {
  constructor(
    private readonly runAsAdmin: <T>(fn: (tx: Database) => Promise<T>) => Promise<T>,
    private readonly logger: Logger,
    private readonly push: ExpoPushSender | null,
    private readonly email: ResendEmailSender | null,
  ) {}

  async notify(payload: NotifyPayload): Promise<void> {
    try {
      const { tokens, userEmail } = await this.runAsAdmin(async (tx) => {
        const devices = await tx
          .select({ token: schema.devices.pushToken })
          .from(schema.devices)
          .where(eq(schema.devices.userId, payload.userId));
        const [user] = await tx
          .select({ email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.id, payload.userId))
          .limit(1);
        return { tokens: devices.map((d) => d.token), userEmail: user?.email };
      });

      if (this.push) await this.push.send(tokens, payload);
      if (this.email && userEmail && payload.type === 'comic_ready') {
        await this.email.send(
          userEmail,
          payload.title,
          `<p>${payload.body}</p><p>Open StoryMe to see your comic.</p>`,
        );
      }
    } catch (err) {
      this.logger.warn({ err: String(err) }, 'notification delivery failed (non-fatal)');
    }
  }
}

/** No-op notifier for local/dev/tests (no channels configured). */
export class NoopNotifier implements Notifier {
  async notify(): Promise<void> {
    /* intentionally does nothing */
  }
}
