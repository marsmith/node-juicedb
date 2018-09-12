# LAMP+node.js stack on raspbian

The following info is a guide to setting up a basic lamp stack on a raspberry pi, including node.js and git

## Requirements

- raspberry pi
- Rasbian OS (tesed using **June 2018** release) [here](https://www.raspberrypi.org/downloads/raspbian/)

## Install raspbian

Follow raspbian installation guide [here](https://www.raspberrypi.org/documentation/installation/installing-images/README.md)

## Configure raspbian

Once you have successfully installed the OS, log in with user "pi" password "raspberry"

Run `sudo raspi-config` to set up:

- wifi network, optional (network options)
- set keyboard layout (localization options)
- set timezone (localization options)

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

**reboot after networking change:** `sudo reboot`

## Setup software
- get server setup script: `wget https://raw.githubusercontent.com/marsmith/node-localjuicedb/master/server-config/server-setup.sh`
- run script: `sh server-setup.sh`


