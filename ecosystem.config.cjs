module.exports = {
  apps: [{
    name: "retail-backend",
    script: "./src/server.js",
    instances: "max",
    exec_mode: "cluster",
    env: {
      NODE_ENV: "production",
      PORT: 5007
    }
  }]
};




