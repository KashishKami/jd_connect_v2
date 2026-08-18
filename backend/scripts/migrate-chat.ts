/* eslint-disable no-console */
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
}

import pool from '../src/lib/db';
import { parseSqlDump } from '../src/lib/copy-parser';
import { execSync } from 'child_process';

export interface ChatMigrationSummary {
  streamsCreated: number;
  messagesMigrated: number;
}

export function formatOriginalTime(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    timeZone: 'America/New_York',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  };
  const formatter = new Intl.DateTimeFormat('en-US', options);
  const parts = formatter.formatToParts(date);

  const day = parts.find((p) => p.type === 'day')?.value || '';
  const month = parts.find((p) => p.type === 'month')?.value || '';
  const year = parts.find((p) => p.type === 'year')?.value || '';
  const hour = parts.find((p) => p.type === 'hour')?.value || '';
  const minute = parts.find((p) => p.type === 'minute')?.value || '';
  const ampm = (parts.find((p) => p.type === 'dayPeriod')?.value || '').toLowerCase();
  return `${day} ${month} ${year}, ${hour}:${minute}${ampm}`;
}

async function fetchWithRetry(url: string, options?: any): Promise<Response> {
  const res = await fetch(url, options);
  if (res.status === 429) {
    try {
      const data = (await res.json()) as { 'retry-after'?: number };
      const retryAfterSec = data['retry-after'] || 0.25;
      const waitMs = Math.ceil(retryAfterSec * 1000) + 50;
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return fetchWithRetry(url, options);
  }
  return res;
}

function getZulipUserAuthHeaders(): Record<number, string> {
  const authHeaders: Record<number, string> = {};
  try {
    const cmd = `docker exec -u zulip zulip-zulip-1 /home/zulip/deployments/current/manage.py shell -c "import json; from zerver.models import UserProfile; print('API_KEYS_JSON_START' + json.dumps({u.id: {'email': u.delivery_email, 'api_key': u.api_key} for u in UserProfile.objects.all()}) + 'API_KEYS_JSON_END')"`;
    const output = execSync(cmd, { encoding: 'utf-8' });
    const match = output.match(/API_KEYS_JSON_START(.*?)API_KEYS_JSON_END/);
    if (match && match[1]) {
      const data = JSON.parse(match[1]);
      for (const [idStr, val] of Object.entries(data)) {
        const id = parseInt(idStr, 10);
        const email = (val as any).email;
        const apiKey = (val as any).api_key;
        if (email && apiKey) {
          authHeaders[id] = 'Basic ' + Buffer.from(`${email}:${apiKey}`).toString('base64');
        }
      }
    }
  } catch (e) {
    console.warn('Could not fetch user API keys from Zulip container:', (e as Error).message);
  }
  return authHeaders;
}

export async function migrateChat(dumpFilePath: string, delayMs = 650): Promise<ChatMigrationSummary> {
  console.log(`Starting chat history migration from: ${dumpFilePath}`);
  const data = await parseSqlDump(dumpFilePath);

  const legacyEmployees = data['employees'] || [];
  const legacyChannels = data['channels'] || [];
  const legacyChannelMembers = data['channel_members'] || [];
  const legacyConversations = data['conversations'] || [];
  const legacyParticipants = data['conversation_participants'] || [];
  const legacyMessages = data['messages'] || [];

  const client = await pool.connect();
  const summary: ChatMigrationSummary = {
    streamsCreated: 0,
    messagesMigrated: 0,
  };

  const baseUrl = process.env.ZULIP_BASE_URL || 'http://localhost:9991';
  const botEmail = process.env.ZULIP_BOT_EMAIL || 'attendance-bot@company.com';
  const botApiKey = process.env.ZULIP_BOT_API_KEY || 'test-api-key';
  const authHeader = 'Basic ' + Buffer.from(`${botEmail}:${botApiKey}`).toString('base64');

  const userAuthHeaderMap = getZulipUserAuthHeaders();

  // Get bot's own Zulip user ID
  let botZulipUserId: number | null = null;
  try {
    const botUserRes = await fetchWithRetry(`${baseUrl}/api/v1/users/${encodeURIComponent(botEmail)}`, {
      headers: { Authorization: authHeader },
    });
    if (botUserRes.ok) {
      const botData = (await botUserRes.json()) as { user_id?: number; user?: { user_id: number } };
      botZulipUserId = botData.user?.user_id ?? botData.user_id ?? null;
      console.log(`Fetched bot user ID: ${botZulipUserId}`);
    }
  } catch (e) {
    console.warn(`Failed to fetch bot user ID: ${(e as Error).message}`);
  }

  try {
    // 1. Build Employee Map (oldEmployeeUUID -> { newId, zulipUserId, name })
    const legacyEmpEmailMap: Record<string, string> = {};
    for (const le of legacyEmployees) {
      if (le.id && le.email) {
        legacyEmpEmailMap[le.id] = le.email.toLowerCase().trim();
      }
    }

    const newEmpRes = await client.query('SELECT id, email, full_name, zulip_user_id FROM employees');
    const newEmpEmailMap: Record<string, { id: string; name: string; zulipUserId: number | null }> = {};
    for (const ne of newEmpRes.rows) {
      newEmpEmailMap[ne.email.toLowerCase().trim()] = {
        id: ne.id,
        name: ne.full_name,
        zulipUserId: ne.zulip_user_id,
      };
    }

    const empMap: Record<string, { newId: string; zulipUserId: number; name: string }> = {};
    for (const [oldId, email] of Object.entries(legacyEmpEmailMap)) {
      const match = newEmpEmailMap[email];
      if (match && typeof match.zulipUserId === 'number') {
        empMap[oldId] = {
          newId: match.id,
          zulipUserId: match.zulipUserId,
          name: match.name,
        };
      }
    }

    // 2. Create Streams and subscribe members
    const streamMap: Record<string, string> = {}; // oldChannelUUID -> streamName
    const channelMembersMap: Record<string, number[]> = {}; // oldChannelUUID -> Array<zulipUserId>

    // Group channel members by channel ID
    for (const member of legacyChannelMembers) {
      if (member.channel_id && member.employee_id) {
        if (!channelMembersMap[member.channel_id]) {
          channelMembersMap[member.channel_id] = [];
        }
        const mappedEmp = empMap[member.employee_id];
        if (mappedEmp) {
          channelMembersMap[member.channel_id].push(mappedEmp.zulipUserId);
        }
      }
    }

    for (const chan of legacyChannels) {
      if (!chan.id || !chan.name) continue;
      const streamName = chan.name;
      const description = chan.description || '';
      const isPrivate = chan.channel_type !== 'department';
      const memberZulipUserIds = [...(channelMembersMap[chan.id] || [])];
      if (botZulipUserId && !memberZulipUserIds.includes(botZulipUserId)) {
        memberZulipUserIds.push(botZulipUserId);
      }

      // Create stream and subscribe members via Zulip subscriptions API
      const subParams = new URLSearchParams();
      subParams.append('subscriptions', JSON.stringify([{ name: streamName, description }]));
      subParams.append('invite_only', isPrivate ? 'true' : 'false');
      if (memberZulipUserIds.length > 0) {
        subParams.append('principals', JSON.stringify(memberZulipUserIds));
      }

      console.log(`Creating/Subscribing stream: ${streamName} (private: ${isPrivate}, members: ${memberZulipUserIds.length})`);
      const subRes = await fetchWithRetry(`${baseUrl}/api/v1/users/me/subscriptions`, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: subParams,
      });

      if (!subRes.ok) {
        const errText = await subRes.text();
        console.error(`Failed to subscribe stream ${streamName}: ${subRes.statusText} - ${errText}`);
      } else {
        summary.streamsCreated++;
      }

      streamMap[chan.id] = streamName;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    // 3. Map DM conversations
    const conversationMap: Record<string, number[]> = {}; // oldConversationUUID -> Array<zulipUserId>
    const conversationParticipantsMap: Record<string, number[]> = {};

    for (const part of legacyParticipants) {
      if (part.conversation_id && part.employee_id) {
        if (!conversationParticipantsMap[part.conversation_id]) {
          conversationParticipantsMap[part.conversation_id] = [];
        }
        const mappedEmp = empMap[part.employee_id];
        if (mappedEmp) {
          conversationParticipantsMap[part.conversation_id].push(mappedEmp.zulipUserId);
        }
      }
    }

    for (const conv of legacyConversations) {
      if (!conv.id) continue;
      const participants = conversationParticipantsMap[conv.id] || [];
      // Sort ascending to enforce a canonical recipient array order
      conversationMap[conv.id] = participants.sort((a, b) => a - b);
    }

    // Sort messages chronologically by created_at ascending
    const sortedMessages = [...legacyMessages].sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      return timeA - timeB;
    });

    // Idempotency caches
    const streamChecked: Record<string, boolean> = {}; // streamName -> hasMessages
    const conversationChecked: Record<string, boolean> = {}; // convKey -> hasMessages

    for (const msg of sortedMessages) {
      if (!msg.body) continue;

      const sender = empMap[msg.sender_id!];
      const senderName = sender ? sender.name : 'Unknown User';
      const createdDate = new Date(msg.created_at!);
      const originalTime = formatOriginalTime(createdDate);

      // Handle attachment skipping
      let bodyText = msg.body;
      const attachments = msg.attachments ? JSON.parse(msg.attachments) : [];
      if (attachments && attachments.length > 0) {
        bodyText += '\n*(attachment not migrated)*';
      }

      // Format attribution blockquote header
      const formattedContent = `> **${senderName}** · ${originalTime}\n>\n${bodyText}`;

      if (msg.channel_id) {
        // Stream message
        const streamName = streamMap[msg.channel_id];
        if (!streamName) continue;

        // Check if stream already has history (idempotency check)
        if (streamChecked[streamName] === undefined) {
          const checkParams = new URLSearchParams();
          checkParams.append('anchor', 'oldest');
          checkParams.append('num_before', '0');
          checkParams.append('num_after', '1');
          checkParams.append(
            'narrow',
            JSON.stringify([
              { operator: 'stream', operand: streamName },
              { operator: 'topic', operand: 'Migrated History' },
            ])
          );

          const checkRes = await fetchWithRetry(`${baseUrl}/api/v1/messages?${checkParams.toString()}`, {
            headers: { Authorization: authHeader },
          });

          if (checkRes.ok) {
            const data = (await checkRes.json()) as { messages: any[] };
            streamChecked[streamName] = data.messages && data.messages.length > 0;
          } else {
            streamChecked[streamName] = false;
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (streamChecked[streamName]) {
          // Already migrated stream message, skip
          continue;
        }

        // Post stream message authenticated as original sender
        const senderAuthHeader = (sender && userAuthHeaderMap[sender.zulipUserId]) || authHeader;
        const msgParams = new URLSearchParams();
        msgParams.append('type', 'stream');
        msgParams.append('to', streamName);
        msgParams.append('topic', 'Migrated History');
        msgParams.append('content', formattedContent);

        const postRes = await fetchWithRetry(`${baseUrl}/api/v1/messages`, {
          method: 'POST',
          headers: {
            Authorization: authHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: msgParams,
        });

        if (!postRes.ok) {
          const errText = await postRes.text();
          console.error(`Failed to post stream message to ${streamName}: ${postRes.statusText} - ${errText}`);
        } else {
          summary.messagesMigrated++;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      } else if (msg.conversation_id) {
        // DM message
        const recipientUserIds = conversationMap[msg.conversation_id];
        if (!recipientUserIds || recipientUserIds.length === 0) continue;

        const convKey = recipientUserIds.join(',');

        // Check if DM thread already has history (idempotency check)
        if (conversationChecked[convKey] === undefined) {
          const checkParams = new URLSearchParams();
          checkParams.append('anchor', 'oldest');
          checkParams.append('num_before', '0');
          checkParams.append('num_after', '1');
          checkParams.append('narrow', JSON.stringify([{ operator: 'pm-with', operand: recipientUserIds }]));

          const checkRes = await fetchWithRetry(`${baseUrl}/api/v1/messages?${checkParams.toString()}`, {
            headers: { Authorization: authHeader },
          });

          if (checkRes.ok) {
            const data = (await checkRes.json()) as { messages: any[] };
            conversationChecked[convKey] = data.messages && data.messages.length > 0;
          } else {
            conversationChecked[convKey] = false;
          }
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }

        if (conversationChecked[convKey]) {
          // Already migrated DM, skip
          continue;
        }

        // Post DM message authenticated as original sender
        const senderAuthHeader = (sender && userAuthHeaderMap[sender.zulipUserId]) || authHeader;
        const targetRecipients = sender
          ? recipientUserIds.filter((id) => id !== sender.zulipUserId)
          : recipientUserIds;
        const toParam = targetRecipients.length > 0 ? targetRecipients : recipientUserIds;

        const msgParams = new URLSearchParams();
        msgParams.append('type', 'direct');
        msgParams.append('to', JSON.stringify(toParam));
        msgParams.append('content', formattedContent);

        const postRes = await fetchWithRetry(`${baseUrl}/api/v1/messages`, {
          method: 'POST',
          headers: {
            Authorization: senderAuthHeader,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: msgParams,
        });

        if (!postRes.ok) {
          const errText = await postRes.text();
          console.error(`Failed to post DM message: ${postRes.statusText} - ${errText}`);
        } else {
          summary.messagesMigrated++;
        }
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    console.log('Chat history migration completed successfully.');
    return summary;
  } catch (err) {
    console.error('Chat history migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

if (require.main === module) {
  const dumpPath = process.argv[2] || 'C:\\Users\\Administrator\\Desktop\\jdconnect_public_data.sql';
  const delay = process.argv[3] ? parseInt(process.argv[3]) : 20;
  migrateChat(dumpPath, delay)
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
