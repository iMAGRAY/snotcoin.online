module.exports = {
  apps: [{
    name: "snotcoin-online",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      HTTP_PORT: 80,
      HTTPS_PORT: 443
    },
    log_date_format: "YYYY-MM-DD HH:mm Z",
    error_file: "/var/log/snotcoin/error.log",
    out_file: "/var/log/snotcoin/output.log",
    watch: false,
    max_memory_restart: "1G"
  }]
};
