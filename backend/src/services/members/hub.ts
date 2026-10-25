/**
 * The Impact Hub wifi: members can log time "in the hub" only from its public addresses. The super admin saves
 * them (or HUB_IPS sets them). With none saved the check is off, so the app works anywhere until it is set up.
 */
import type { HubNetwork, HubWifiResponse } from '@hub-pulse/shared';
import { db } from '../../core/db';
import { config } from '../../core/config';
import { badRequest } from '../../core/errors';

export const hubWifi = async (current: string): Promise<HubWifiResponse> => ({
  current,
  fromConfig: config.hubIps,
  addresses: (await db.hubAddress.findMany({ orderBy: { createdAt: 'asc' } })).map((a) => ({
    ip: a.ip, label: a.label, createdAt: a.createdAt.toISOString(),
  })),
});

export const addHubAddress = async (ip: string, label = ''): Promise<void> => {
  if (!ip || ip === 'unknown') throw badRequest('There is no address to save.');
  await db.hubAddress.upsert({ where: { ip }, create: { ip, label }, update: { label } });
};

export const removeHubAddress = async (ip: string): Promise<void> => {
  await db.hubAddress.deleteMany({ where: { ip } });
};

export const hubNetwork = async (ip: string): Promise<HubNetwork> => {
  const saved = (await db.hubAddress.findMany({ select: { ip: true } })).map((a) => a.ip);
  const all = [...config.hubIps, ...saved];
  return { checked: all.length > 0, atHub: all.includes(ip), ip };
};
