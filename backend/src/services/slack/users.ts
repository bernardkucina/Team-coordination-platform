/** Finds a member's Slack account and their direct-message channel with the bot. */
import { getMember, setSlackUserId } from '../members';
import { SlackError, slack } from './client';

/** Emails Slack did not know, so they are not looked up again for a while. */
const misses = new Map<string, number>();
const MISS_TTL_MS = 10 * 60_000;
const channels = new Map<string, string>();

export interface SlackTarget {
  userId: string;
  channel: string;
}

/** The member's Slack user and DM channel, or null when they have no Slack account (or are inactive). */
export const slackTargetFor = async (memberId: string): Promise<SlackTarget | null> => {
  const member = await getMember(memberId);
  if (!member.active) return null;

  let userId = member.slackUserId;
  if (!userId) {
    // The Slack email set by the super admin; otherwise the roster email, in case it is the real one.
    const email = member.slackEmail ?? member.email;
    const missedAt = misses.get(email);
    if (missedAt && Date.now() - missedAt < MISS_TTL_MS) return null;
    try {
      const found = await slack<{ user: { id: string } }>('users.lookupByEmail', { email });
      userId = found.user.id;
      await setSlackUserId(member.id, userId);
    } catch (err) {
      if (err instanceof SlackError && err.code === 'users_not_found') {
        misses.set(email, Date.now());
        return null;
      }
      throw err;
    }
  }

  let channel = channels.get(userId);
  if (!channel) {
    channel = (await slack<{ channel: { id: string } }>('conversations.open', { users: userId })).channel.id;
    channels.set(userId, channel);
  }
  return { userId, channel };
};

/** Sends a direct message now. Returns false when the member has no Slack account. */
export const sendDm = async (memberId: string, message: { text: string; blocks?: unknown[] }): Promise<boolean> => {
  const target = await slackTargetFor(memberId);
  if (!target) return false;
  await slack('chat.postMessage', { channel: target.channel, text: message.text, blocks: message.blocks, unfurl_links: false });
  return true;
};
