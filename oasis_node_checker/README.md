# oasis_node_checker

##install
npm install

npm install -g pm2

pm2 start ./app.json

pm2 stop oasis_node_checker

pm2 delete oasis_node_checker

tail -f ~/.pm2/logs/oasis-node-checker-error.log
