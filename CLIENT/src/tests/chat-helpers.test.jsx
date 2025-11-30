import { describe, it, expect } from 'vitest';
import { idMatches, isOnlineForItem, getOnlineMapMatchKey } from '../global/utils/chatHelpers';

describe('chatHelpers', () => {
  it('idMatches correctly matches different id fields', () => {
    const item = { id: '123', _id: 'abc', userId: 'uid-1' };
    expect(idMatches(item, '123')).toBe(true);
    expect(idMatches(item, 'abc')).toBe(true);
    expect(idMatches(item, 'uid-1')).toBe(true);
    expect(idMatches(item, 'nope')).toBe(false);
  });

  it('getOnlineMapMatchKey returns matching key when present', () => {
    const item = { id: '5' };
    const onlineMap = { '5': { online: true }, 'other': { online: false } };
    expect(getOnlineMapMatchKey(item, onlineMap)).toBe('5');
    const byUid = { userId: 'u-1' };
    const om2 = { 'u-1': { online: true } };
    expect(getOnlineMapMatchKey(byUid, om2)).toBe('u-1');
  });

  it('isOnlineForItem returns true/false correctly', () => {
    const onlineMap = { 'user-1': { online: true }, 'user-2': { online: false } };
    const itemOn = { id: 'user-1' };
    const itemOff = { id: 'user-2' };
    const itemMissing = { id: 'user-3' };
    expect(isOnlineForItem(itemOn, onlineMap)).toBe(true);
    expect(isOnlineForItem(itemOff, onlineMap)).toBe(false);
    expect(isOnlineForItem(itemMissing, onlineMap)).toBe(false);
  });
});
