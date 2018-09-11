#!/bin/sh

#args
USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
APP_PATH="/srv"
USER=$SUDO_USER
LIST_OF_MAIN_APPS="git mariadb-client mariadb-server php7.0 php7.0-mysql apache2 libapache2-mod-php7.0 phpmyadmin"

#universal script to install latest node.js on any raspberry pi version
wget -O - https://raw.githubusercontent.com/audstanley/NodeJs-Raspberry-Pi/master/Install-Node.sh | bash;

#install apps
apt-get update  # To get the latest package lists
#apt-get upgrade #upgrade all softwares
apt-get install -y $LIST_OF_MAIN_APPS

#download repos
git clone https://github.com/marsmith/node-localjuicedb ${APP_PATH}
git clone https://github.com/marsmith/thejuicefeed ${APP_PATH}

#create symbolic link
ln -s ${APP_PATH}/thejuicefeed /var/www/html/thejuicefeed

#setup up cron jobs
(crontab -u ${USER} -l; echo "*/10 * * * * /usr/bin/nodejs ${APP_PATH}/node-localjuicedb/getUntappd.js" ) | crontab -u ${USER} -
(crontab -u ${USER} -l; echo "*/10 * * * * /usr/bin/nodejs ${APP_PATH}/node-localjuicedb/getInstagram.js" ) | crontab -u ${USER} -
(crontab -u ${USER} -l; echo "*/10 * * * * /usr/bin/nodejs ${APP_PATH}/node-localjuicedb/getTwitter.js" ) | crontab -u ${USER} -

#create blank database
echo "Please enter root user MySQL password!"
    read rootpasswd
    mysql -uroot -p${rootpasswd} -e "CREATE DATABASE localjuicefeed;"

### create virtual host rules file
echo "
    <VirtualHost *:80>
      ServerName thejuicefeed.com
      ServerAlias www.thejuicefeed.com
      DocumentRoot /var/www/html/thejuicefeed
      ErrorLog ${APACHE_LOG_DIR}/error.log
      CustomLog ${APACHE_LOG_DIR}/access.log combined
    </VirtualHost>" > '/etc/apache2/sites/available/thejuicefeed.com.conf'
echo -e $"\nNew Virtual Host Created\n"

#enable and disable
a2dissite 000-default
a2ensite thejuicefeed.com

#restart apache2
systemctl restart apache2 
