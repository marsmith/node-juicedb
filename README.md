# node-percentOverlay

* proof of concept for calculating percent overlayers from input geojson against a filegdb set of regional polygons
* all node-gdal based

```
sudo apt-get install npm nodejs-legacy
npm install -g npm forever
sudo npm install npm -g
```

clone repo
```
git clone https://github.com/marsmith/node-zonalstats.git
cd node-zonalstats
npm install
```

to start:
```
npm start
```

OR to start as background process:
```
forever start ./bin/www
```

OR run with VS Code built in debugger

**To test**
use Chrome REST test add-on such as: "Advanced REST Client"

 - change to "POST", set type as "application/json"
 - change request URL to "http://localhost:3000/percentOverlay"
 - post body the contents of /input/basinSS.geojson
 - send the request
