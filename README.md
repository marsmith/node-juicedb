# LAMP+node.js stack on raspbian

The following info is a guide to setting up a basic lamp stack on a raspberry pi, including node.js and git

## Requirements

- raspberry pi
- Rasbian OS (tesed using **June 2018** release) [here](https://www.raspberrypi.org/downloads/raspbian/)

## Install raspbian

Follow raspbian installation guide [here](https://www.raspberrypi.org/documentation/installation/installing-images/README.md)

## Configure network
Once you have successfully installed the OS, log in with user "pi" password "raspberry"

**Wireless config**:
edit wireless setup file with `sudo nano /etc/wpa_supplicant/wpa_supplicant.conf`
```
ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1 
country=US 

network={ 
	ssid="Your network SSID" 
	scan_ssid=1
	psk="Your WPA/WPA2 security key" 
	key_mgmt=WPA-PSK 
}
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

## Configure locale

If keyboard keys not correct set locale with : `sudo raspi-config` then `sudo reboot`

## Setup software



