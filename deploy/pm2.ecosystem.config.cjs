module.exports = {
  apps: [
    {
      name: "chin-crm",
      script: "dist/index.js",
      cwd: "/opt/chin-crm",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
    },
  ],
};
