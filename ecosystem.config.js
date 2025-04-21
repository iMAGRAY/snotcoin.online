module.exports = {
  apps: [{
    name: "kingcoin-online",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      HTTP_PORT: 3000,
      HTTPS_PORT: 443
    },
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "/var/log/kingcoin/error.log",
    out_file: "/var/log/kingcoin/output.log",
    watch: false,
    max_memory_restart: "1G"
  }]
};
