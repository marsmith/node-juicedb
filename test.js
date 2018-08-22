
var mysql = require( 'mysql' );
var dbInfo = require('./dbInfo.js');

var untappdTableName = 'untappd';
var daysToExpire = 14;

class Database {
    constructor( config ) {
        this.connection = mysql.createConnection( config );
    }
    query( sql, args ) {
        return new Promise( ( resolve, reject ) => {
            this.connection.query( sql, args, ( err, rows ) => {
                if ( err )
                    return reject( err );
                resolve( rows );
            } );
        } );
    }
    close() {
        return new Promise( ( resolve, reject ) => {
            this.connection.end( err => {
                if ( err )
                    return reject( err );
                resolve();
            } );
        } );
    }
}

Database.execute = function( config, callback ) {
    var database = new Database( config );
    return callback( database ).then(
        result => database.close().then( () => result ),
        err => database.close().then( () => { throw err; } )
    );
};

cleanupUntappd = function() {

    return new Promise(function(resolve, reject){ 

        //create table if it doesn't exist
        var createTableSQL = "CREATE TABLE IF NOT EXISTS `" + untappdTableName  + "` (uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY,beertime DATETIME,venue TEXT(100),idx INT,name VARCHAR(100),brewery TEXT(100),style TEXT(100),ABV TEXT(10),IBU TEXT(10),rating TEXT(10),prices TEXT(100),beerLogoURL TEXT(100),beerUntappdURL TEXT(100),venueUntappdURL TEXT(100),venueUntappdLogoURL TEXT(100),venueAddress TEXT(100))";

        //cleanup old records
        var cleanupSQL = "DELETE FROM `" + untappdTableName  + "` WHERE beertime < NOW() - INTERVAL " + daysToExpire + " DAY";

        Database.execute( dbInfo.data,
            //first query checks if database exists if not creates it
            database => database.query(createTableSQL)
            //second query cleans up old records in database
            .then( rows => {
                return database.query(cleanupSQL);
            } )
        ).then( () => {
            resolve({"result": "Finished untappd DB cleanup"});

        } ).catch( err => {
            console.log('there was an error',err);
        } );
    });
};

getUntappdMenu = function(venue) {

    return new Promise(function(resolve, reject){ 

            //loop over venues in untappd venue request
        var options = {
            uri: untappdVenueURL + venue,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4'
            },
            transform: function (body) {
                return cheerio.load(body);
            }
        };

        //start request promise
        rp(options)
        .then(function ($) {

            var beerInfos = [];

            //get venue details
            var venueNameFull = $('.header-details').find('.venue-name').find('h1').text().trim().replace("'","");
            var venueAddress = $('.header-details').find('.address').text().replace("( Map )","").trim();
            var venueUntappdURL = 'https://untappd.com' + $('.header-details').find('.logo').find('a').attr('href');
            var venueUntappdLogoURL = $('.header-details').find('.logo').find('img').attr('src');

            var connection = mysql.createConnection(dbInfo.data);

            //make sure we avoid the 'On deck' menu section
            var beerList = [];
            $('.menu-section').each(function(i,menuSection){
                var category = $(menuSection).find('.menu-section-header').find('h4').clone().children().remove().end().text().trim();

                if (category !== "On Deck") {
                    $(menuSection).find('.menu-section-list').find('li').each(function(i,beer){
                        beerList.push(beer);
                    });
                }
            });
            
            Promise.each(beerList,function (beer) {
    
                var beerInfo = {};            
                beerInfo.venueNameFull = venueNameFull;
                beerInfo.venueUntappdURL = venueUntappdURL;
                beerInfo.venueUntappdLogoURL = venueUntappdLogoURL;
                beerInfo.venueAddress = venueAddress;

                //console.log(beerInfo);

                //get beer details
                var $beerDetailsH5 = $(beer).find('.beer-details').find('h5');
                var $beerDetailsH6 = $(beer).find('.beer-details').find('h6');
                
                //check for beers that dont have a number
                if ($beerDetailsH5.find('a').text().indexOf('.') != -1) {
                    beerInfo.name = $beerDetailsH5.find('a').text().split('.')[1].trim().replace("'","");
                    beerInfo.index = parseInt($beerDetailsH5.find('a').text().split('.')[0]);
                }
                else {
                    beerInfo.name = $beerDetailsH5.find('a').text().trim().replace("'","");
                    beerInfo.index = 0;
                }
                beerInfo.beerLogoURL = $(beer).find('.beer-label').find('img').attr('src');
                var beerDetails = $beerDetailsH6.find('span').text().split('•');
                beerInfo.ABV = beerDetails[0].replace('ABV','').trim();
                beerInfo.IBU = beerDetails[1].replace('IBU','').trim();
                beerInfo.brewery = beerDetails[2].trim().replace("'","");
                beerInfo.style = $beerDetailsH5.find('em').text().replace("'","");
                if ($beerDetailsH6.find('span').last().attr('class')) beerInfo.rating = (parseFloat($beerDetailsH6.find('span').last().attr('class').split('rating xsmall r')[1].trim())/100).toFixed(2);
                else beerInfo.rating = 'N/A';
                beerInfo.beerUntappdURL = 'https://untappd.com' + $beerDetailsH5.find('a').attr('href');
                var prices = [];
                $(beer).find('.beer-prices').find('p').each(function(i,item){
                    prices.push($(item).text().trim());
                });
                beerInfo.prices = prices.join('|');
                beerInfos.push(beerInfo);

            }).then(function(){
                console.log('Found ' + beerInfos.length + ' items for ' + beerInfos[0].venueNameFull);
        
                async.each(beerInfos, function (beerInfo, callback) {
                        
                    //only do this if this beer has an index
                    if (beerInfo.index != 0) {

                        var checkRecordsSQL = "SELECT * FROM `" + untappdTableName  + "` WHERE idx=" + beerInfo.index + " AND venue='" + beerInfo.venueNameFull + "'";

                        //console.log('SQL: ' + checkRecordsSQL);
    
                        connection.query(checkRecordsSQL, function(err, rows, fields){
                            if(!err){
                                //console.log(JSON.stringify(rows.length));
            
                                if (rows.length === 0) {
                                    logger.info('Need to add this beer or update index: ' + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                    
                                    var insertBeerSQL = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerLogoURL,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL,venueAddress) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerLogoURL + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "','" + beerInfo.venueAddress + "')";
                    
                                    //console.log('SQL: ' + insertBeerSQL);
                                    connection.query(insertBeerSQL, function(err, rows, fields){
                                        if(!err){
                                            logger.warn("Added untappd item: " + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                            callback(null);
                                        } else {
                                            console.log("Error while performing Query" + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                            callback(err);
                                        }
                                    });
                                
                                }
                                //this beer at this index needs to be updated
                                else if (rows.length === 1) {
                    
                                    var data = JSON.parse(JSON.stringify(rows[0]));
                    
                                    //chek if we have this entry already
                                    if (data.idx === beerInfo.index && data.name === beerInfo.name && data.venue === beerInfo.venueNameFull) {
                                        logger.info('Already exists in the DB at this venue at this index: ' + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                        callback(null);
                                    }
                                    //check if new beer at this index
                                    if (data.idx === beerInfo.index && data.name !== beerInfo.name && data.venue === beerInfo.venueNameFull) {
                                        logger.info('New beer at this venue and index: ' + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                    
                                        var updateBeerSQL = "UPDATE `" + untappdTableName  + "` SET beertime='" + new Date().toLocaleString() + "',idx='" + beerInfo.index + "',name='" + beerInfo.name + "',brewery='" + beerInfo.brewery + "',style='" + beerInfo.style + "',ABV='" + beerInfo.ABV + "',IBU='" + beerInfo.IBU + "',rating='" + beerInfo.rating + "',prices='" + beerInfo.prices + "',beerLogoURL='" + beerInfo.beerLogoURL + "',beerUntappdURL='" + beerInfo.beerUntappdURL + "' WHERE idx='" + beerInfo.index + "' AND venue='" + beerInfo.venueNameFull + "'";
                    
                                        //console.log('SQL: ', updateBeerSQL);
    
                                        connection.query(updateBeerSQL, function(err, rows, fields){
                                            if(!err){
                                                logger.warn("Updated untappd item: " + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                                callback(null);
                                            } else {
                                                console.log("Error while performing Query" + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                                callback(err);
                                            }
                                        });
                                    }   
                                }
                                //we have a venue that doesn't use indexes so just add the beer
                                else if (rows.length > 1) {
                                    logger.info('Multiple beers found for this venue at this index: ' + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);

                                    callback(null);
                                }
                                else {
                                    logger.info('There was some other error: ' + beerInfo.index + ' | ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);

                                    callback(null);
                                }
    
                            } else {
                                logger.error(err);
                                callback(err);
                            }
                        });
                    }

                    //the venue doesn't use indexes
                    else {
                        console.log('THIS VENUE DOESNT USE INDEXES: ' + beerInfo.venueNameFull);

                        var checkRecordsSQL = "SELECT * FROM `" + untappdTableName  + "` WHERE idx=" + beerInfo.index + " AND venue='" + beerInfo.venueNameFull + "' AND name='" + beerInfo.name + "'";

                        //console.log('SQL: ' + checkRecordsSQL);
    
                        connection.query(checkRecordsSQL, function(err, rows, fields){
                            if(!err){

                                //console.log(JSON.stringify(rows.length));
            
                                //query didn't find anything so we need to add a beer
                                if (rows.length === 0) {

                                    logger.info('Need to add this beer (venue doesnt use index): ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                    
                                    var insertBeerSQL = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerLogoURL,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL,venueAddress) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerLogoURL + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "','" + beerInfo.venueAddress + "')";
                    
                                    //console.log('SQL: ' + insertBeerSQL);
                                    connection.query(insertBeerSQL, function(err, rows, fields){
                                        if(!err){
                                            logger.warn("Added untappd item: " + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                            callback(null);
                                        } else {
                                            console.log("Error while performing Query"  + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                            callback(err);
                                        }
                                    });
                                
                                }
                                //this beer at this index needs to be updated
                                else if (rows.length === 1) {
                                    logger.info('Already exists (venue doesnt use index): ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);

                                    callback(null);
                                }
                                //we have a venue that doesn't use indexes so just add the beer
                                else if (rows.length > 1) {
                                    logger.info('Multiple beers already exist (venue doesnt use index): ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);

                                    callback(null);
                                }
                                else {
                                    logger.info('There was some other error (venue doesnt use index): ' + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);

                                    callback(null);
                                }
    
                            } else {
                                logger.error(err);
                                callback(err);
                            }
                        });

                        //callback(null);
                    }
    
                }, function(err){
                    if(err){
                        logger.error(err);
                        connection.end();
                    }else{
                        //console.log('finally done');
                        connection.end();
                        resolve(beerInfos);
                    }
                });   
            });
        })        
        .catch(function (err) {
            logger.error('There was an error getting the menu from untappd for:',venue);
        });
    });
};

cleanupUntappd();
