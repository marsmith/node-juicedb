#!/bin/sh

#args
MYSQL_PASSWORD='abc123'
MYSQL_DATABASE='juicedb'
LIST_OF_MAIN_APPS="git mariadb-client mariadb-server apache2 php7.0 php7.0-mysql libapache2-mod-php7.0 phpmyadmin"

#universal script to install latest node.js on any raspberry pi version
wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | sudo bash

#install apps
sudo apt-get update  # To get the latest package lists
#apt-get upgrade #upgrade all softwares
sudo apt-get install -y ${LIST_OF_MAIN_APPS}

#download repos
git clone https://github.com/marsmith/node-localjuicedb ${HOME}/node-juicedb
git clone https://github.com/marsmith/thejuicefeed ${HOME}/thejuicefeed

#install npm dependencies
npm install --prefix ${HOME}/node-juicedb

#create symbolic link
sudo ln -s ${HOME}/thejuicefeed /var/www/html/thejuicefeed

#setup up cron jobs
(crontab -u ${USER} -l; echo "*/15 * * * * /usr/bin/node ${HOME}/node-juicedb/getJuice.js" ) | crontab -u ${USER} -

#mysql setup
sudo mysql -uroot -p${MYSQL_PASSWORD} -e "UPDATE mysql.user SET Password = PASSWORD('${MYSQL_PASSWORD}') WHERE User = 'root'"
sudo mysql -uroot -p${MYSQL_PASSWORD} -e "CREATE DATABASE ${MYSQL_DATABASE};"
echo "UPDATE mysql.user SET plugin = 'mysql_native_password' WHERE user = 'root' AND plugin = 'unix_socket';FLUSH PRIVILEGES;" | sudo mysql -u root -p{MYSQL_PASSWORD}

### create virtual host rules file
echo "
    <VirtualHost *:80>
      ServerName thejuicefeed.com
      ServerAlias www.thejuicefeed.com
      DocumentRoot /var/www/html/thejuicefeed
      ErrorLog ${APACHE_LOG_DIR}/error.log
      CustomLog ${APACHE_LOG_DIR}/access.log combined
    </VirtualHost>" | sudo tee --append '/etc/apache2/sites-available/thejuicefeed.com.conf'
echo -e $"\nNew Virtual Host Created\n"

#enable and disable
sudo a2dissite 000-default
sudo a2ensite thejuicefeed.com

#restart apache2
sudo systemctl restart apache2 
