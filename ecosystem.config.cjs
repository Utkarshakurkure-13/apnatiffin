module.exports = {
  apps: [
    {
      name: 'aapna-tiffin-server',
      script: 'server/index.js',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 5000,
        HOST: '0.0.0.0',
        EC2_IP: '13.127.161.95'
      }
    }
  ]
};
