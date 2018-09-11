#!/bin/sh

#args
USER_HOME=$(getent passwd $SUDO_USER | cut -d: -f6)
APP_PATH="/home/pi"
USER=$SUDO_USER
LIST_OF_MAIN_APPS="nodejs apache2 mariadb-server"

#install nodesource repo
curl -sL https://deb.nodesource.com/setup_10.x | sudo -E bash -

#install apps
apt-get update  # To get the latest package lists
apt-get install -y $LIST_OF_MAIN_APPS

#create symbolic link
ln -s ${APP_PATH}/thejuicefeed /var/www/html/thejuicefeed

#setup up cron jobs
(crontab -u ${USER} -l; echo "*/5 * * * * ${APP_PATH}/nwis-mapper/server-config/chkCherry.sh" ) | crontab -u ${USER} -
(crontab -u ${USER} -l; echo "0 0 * * 0 rm -rf ${APP_PATH}/nwis-mapper/mapper/exporter/temp/*" ) | crontab -u ${USER} -

#add new virtual site
cp ${APP_PATH}/nwis-mapper/server-config/nwis-mapper.conf /etc/apache2/sites-available/nwis-mapper.conf
cp ${APP_PATH}/nwis-mapper/server-config/nwis-mapper-ssl.conf /etc/apache2/sites-available/nwis-mapper-ssl.conf
a2dissite 000-default
a2ensite nwis-mapper
a2ensite nwis-mapper-ssl

