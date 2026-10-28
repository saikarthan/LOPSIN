# Lopsin collector agent.
# Runs inside the customer estate. Outbound HTTPS only - EXPOSEs no port.
FROM node:22-alpine

WORKDIR /opt/lopsin
COPY package.json agent.js ./

# Run unprivileged: the agent needs no elevated access to do its job.
USER node

ENV LOPSIN_API=https://api.lopsin.io/api

ENTRYPOINT ["node", "agent.js"]
