#!/bin/sh

#args
MYSQL_PASSWORD='abc123'
MYSQL_DATABASE='juicedb'
LIST_OF_MAIN_APPS="git mariadb-client mariadb-server"

#universal script to install latest node.js on any raspberry pi version
wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | sudo bash

#install apps
sudo apt-get update  # To get the latest package lists
sudo apt-get install -y ${LIST_OF_MAIN_APPS}

#download repos
git clone https://github.com/marsmith/node-juicedb ${HOME}/node-juicedb

#install npm dependencies
npm install --prefix ${HOME}/node-juicedb
npm audit fix --prefix ${HOME}/node-juicedb

#setup up cron jobs
(crontab -u ${USER} -l; echo "*/15 * * * * /usr/bin/node ${HOME}/node-juicedb/getJuice.js" ) | crontab -u ${USER} -

#mysql setup
sudo mysql -uroot -p${MYSQL_PASSWORD} -e "UPDATE mysql.user SET Password = PASSWORD('${MYSQL_PASSWORD}') WHERE User = 'root'"
sudo mysql -uroot -p${MYSQL_PASSWORD} -e "CREATE DATABASE ${MYSQL_DATABASE};"
echo "UPDATE mysql.user SET plugin = 'mysql_native_password' WHERE user = 'root' AND plugin = 'unix_socket';FLUSH PRIVILEGES;" | sudo mysql -u root -p{MYSQL_PASSWORD}

#install pm2 to persistenly run node express server
sudo npm install pm2 -g

#create symlink for pm2 to enable user run
sudo ln -s /opt/nodejs/bin/pm2 /usr/bin/pm2

#start pm2
pm2 start ${HOME}/node-juicedb/server.js 
pm2 startup
sudo env PATH=$PATH:/opt/nodejs/bin /opt/nodejs/lib/node_modules/pm2/bin/pm2 startup systemd -u ${USER} --hp ${HOME}

