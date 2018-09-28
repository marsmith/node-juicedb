# LAMP+node.js stack on raspbian

The following info is a guide to setting up a basic lamp stack on a raspberry pi, including node.js and git

## Requirements

- HARDWARE: (raspberry pi microSD card, micro USB power supply, HDMI cable, monitor, keyboard).  Monitor and keyboard only necessary for initial setup.
- SOFTWARE: Rasbian OS image (tesed using **June 2018** release) [here](https://www.raspberrypi.org/downloads/raspbian/)

## Install raspbian

Follow steps from raspbian installation guide [here](https://www.raspberrypi.org/documentation/installation/installing-images/README.md)

- Download appropriate raspbian image
- Download and install Etcher.io
- Flash image to microSD card
- Insert microSD card into pi and plug in

## Configure raspbian

Once you have successfully installed the OS, log in with user "pi" password "raspberry"

Run `sudo raspi-config` to run raspberry pi config wizard:

- wifi network, optional (network options)
- enable SSH for remote access (interface options)
- set keyboard layout (localization options)
- set timezone (localization options)
- change default password

Additional security measures (optional but recommended):
- Update all software: `sudo apt-get update` then `sudo apt-get upgrade`.
- Add a new user, and delete default 'pi' user: `sudo adduser alice`.
- To make new user part of the sudo group: `sudo adduser alice sudo`.
- Delete 'pi' user: `sudo deluser -remove-home pi`.
- Install firewall: `sudo apt-get install ufw`.
- Reboot: `sudo reboot`.
- Enable firewall: `sudo ufw enable`.
- Allow access to ports: `sudo ufw allow 80`.

**Wireless config**:
edit wireless setup file with `sudo nano /etc/network/interfaces` and add this to the bottom:

```
allow-hotplug wlan0
iface wlan0 inet manual
    wpa-conf /etc/wpa_supplicant/wpa_supplicant.conf
```

**Wired config (using DHCP)**: 
Shouldn't have to do anything

**Wired config (static IP)**:
edit IP configuration file: `sudo nano /etc/dhcpcd.conf` add the following to the bottom of the file (ensure the static IP being set is not already in use on the network).

```
#static IP configuration 

interface eth0
static ip_address=192.168.50.50/24 
static routers=192.168.50.1 
static domain_name_servers=192.168.50.1
```

**reboot after any networking change:** `sudo reboot`

## Setup software
- get server setup script: `wget -O server-setup.py https://bit.ly/2NAFOFM`
- run script: `sh server-setup.sh`

## Configure juicedb
Edit config file and replace juice venue values as needed: `nano node-juicedb/config.js`

check Cron with `crontab -e`.  The script should be automatically running every 15 minutes to pull new juice data.
