/**
 * PM2 ecosystem config - FMIS Budget
 *
 * Sa PM2, ang dapat patakbuhin ay ang BACKEND (SERVER). Ang client (dist)
 * pwedeng i-serve ng IIS/nginx, o kung gusto mo sa PM2 din, uncomment ang "client".
 *
 * Gamit: mula sa project root
 *   pm2 start ecosystem.config.cjs
 *   pm2 start ecosystem.config.cjs --only server   # backend lang
 *   pm2 start ecosystem.config.cjs --only client  # kung naka-uncomment ang client
 */

module.exports = {
  apps: [
    {
      name: "fmis-budget-server",
      script: "SERVER/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "development" },
      env_production: { NODE_ENV: "production" },
      // Kung naka-.env sa root, automatic mababasa; kung nasa SERVER, ilagay dotenv path
      // node_args: "-r dotenv/config",
      // error_file / out_file optional (default: ~/.pm2/logs)
      merge_logs: true,
    },
    // Opsiyonal: i-serve ang CLIENT/dist sa port 3005 (kung hindi mo gagamitin ang IIS/nginx)
    // Uncomment pagkatapos: npm install -g serve (o npm install serve --save-dev sa CLIENT)
    // {
    //   name: "fmis-budget-client",
    //   script: "npx",
    //   args: "serve CLIENT/dist -l 3005",
    //   cwd: __dirname,
    //   instances: 1,
    //   exec_mode: "fork",
    //   env: { NODE_ENV: "production" },
    // },
  ],
};
