export const idMatches = (item, userId) => {
  if (!item || !userId) return false;
  const uid = String(userId);
  const candidates = [item.id, item._id, item.userId, item.Id, item.uid, item.uuid];
  for (const c of candidates) {
    if (c !== undefined && c !== null && String(c) === uid) return true;
  }
  return false;
};

export const getOnlineMapMatchKey = (item, onlineMap) => {
  if (!item || !onlineMap) return null;
  return Object.keys(onlineMap).find((k) => idMatches(item, k));
};

export const isOnlineForItem = (item, onlineMap) => {
  const k = getOnlineMapMatchKey(item, onlineMap);
  return k ? Boolean(onlineMap[k]?.online) : false;
};
