const RoutePermission = require("../models/RoutePermission");

let cacheMap = null;
let lastCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

module.exports = {
  /**
   * Gets the route permission from memory. If cache is stale or empty, it queries the DB.
   * @param {string} path 
   * @returns {Object|null}
   */
  getPermission: async (path) => {
    if (!cacheMap || Date.now() - lastCacheTime > CACHE_TTL) {
      try {
        const allPerms = await RoutePermission.find().lean();
        cacheMap = new Map();
        allPerms.forEach(p => cacheMap.set(p.path, p));
        lastCacheTime = Date.now();
      } catch (err) {
        console.error("[RoutePermissionCache] Failed to load permissions:", err.message);
        // Fallback to direct DB query if cache fails to populate
        return await RoutePermission.findOne({ path }).lean();
      }
    }
    return cacheMap.get(path);
  },
  
  /**
   * Clears the cache so it will be rebuilt on the next getPermission call.
   */
  invalidate: () => {
    cacheMap = null;
    lastCacheTime = 0;
  }
};
