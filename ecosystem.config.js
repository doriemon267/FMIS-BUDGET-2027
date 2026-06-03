module.exports = {
  apps: [
    {
      name: "budget-server",
      script: "index.js",
      cwd: "./SERVER",
      watch: true,
      ignore_watch: ["node_modules"],
      env: {
        NODE_ENV: "development",
      }
    },
    {
      name: "budget-client",
      // PALITAN ITO DEPENDE SA FRAMEWORK MO (Tingnan ang Step 1 sa itaas)
      script: "./node_modules/vite/bin/vite.js", 
      cwd: "./CLIENT",
      watch: false,
      env: {
        NODE_ENV: "development",
      }
    }
  ]
};