import dotenv from 'dotenv';
import { buildAttendancePromptMessage } from './builder';

dotenv.config();

export interface PosterConfig {
  baseUrl: string;
  botEmail: string;
  botApiKey: string;
  streamName: string;
  clockAppUrl: string;
}

export async function postDailyAttendancePrompt(config: PosterConfig): Promise<{ success: boolean; messageId?: number; error?: string }> {
  const authHeader = 'Basic ' + Buffer.from(`${config.botEmail}:${config.botApiKey}`).toString('base64');
  const messageContent = buildAttendancePromptMessage(config.clockAppUrl);

  const params = new URLSearchParams();
  params.append('type', 'stream');
  params.append('to', config.streamName);
  params.append('topic', 'Daily Attendance Prompt');
  params.append('content', messageContent);

  try {
    const response = await fetch(`${config.baseUrl}/api/v1/messages`, {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = (await response.json()) as { result: string; id?: number; msg?: string };
    if (!response.ok || data.result !== 'success') {
      return { success: false, error: data.msg || `HTTP status ${response.status}` };
    }

    if (typeof data.id === 'number') {
      return { success: true, messageId: data.id };
    }
    return { success: true };
  } catch (err) {
    return { success: false, error: (err as Error).message };
  }
}

// Standalone execution wrapper
if (require.main === module) {
  const config: PosterConfig = {
    baseUrl: process.env.ZULIP_BASE_URL || 'http://127.0.0.1:9991',
    botEmail: process.env.ZULIP_BOT_EMAIL || 'jdconnect-bot@company.com',
    botApiKey: process.env.ZULIP_BOT_API_KEY || 'zulip_bot_api_key_here',
    streamName: process.env.ZULIP_ATTENDANCE_STREAM || 'attendance',
    clockAppUrl: process.env.CLOCK_APP_URL || 'https://clock.yourcompany.com',
  };

  postDailyAttendancePrompt(config)
    .then((res) => {
      if (res.success) {
        console.info(`[Zulip Bot] Successfully posted attendance prompt (Message ID: ${res.messageId})`);
      } else {
        console.error(`[Zulip Bot] Failed to post message: ${res.error}`);
        process.exit(1);
      }
    })
    .catch((err) => {
      console.error('[Zulip Bot] Fatal error:', err);
      process.exit(1);
    });
}
