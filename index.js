var rp = require('request-promise');
var cheerio = require('cheerio');
var mysql = require( 'mysql' );
var request = require('request');
var Promise = require('bluebird');
var async   = require('async');
var scrapetwitter = require('scrape-twitter');
var { createLogger, format, transports } = require('winston');
var { combine, timestamp, printf } = format;
var dbInfo = require('./dbInfo.js');

var untappdTableName = 'untappd';
var instagramTableName = 'instagram';
var twitterTableName = 'twitter';
var untappdUserURL = 'https://untappd.com/user/';
var untappdVenueURL = 'https://untappd.com/v/';
var instagramURL = 'https://www.instagram.com/';
var numInstagramPosts = 5;
var numTweets = 10;
dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;
var connection;
var daysToExpire = 14;

var logFormat = printf(info => {
    info.timestamp = new Date().toLocaleString();
    return `${info.timestamp} ${info.level}: ${info.message}`;
});

var logger = createLogger({
    level: 'info',
    format: combine(
        timestamp(),
        logFormat
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'combined.log' })
    ]
});

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

exports.cleanupUntappd = function() {

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

exports.getUntappdMenu = function(venue) {

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

                beerInfo.beertime = formatDate(new Date());
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
                    
                                    var insertBeerSQL = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerLogoURL,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL,venueAddress) VALUES ('" + beerInfo.beertime + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerLogoURL + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "','" + beerInfo.venueAddress + "')";
                    
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

exports.getUntappdUser = function(user) {

    return new Promise(function(resolve, reject){ 

        //loop over checkins
        var options = {
            uri: untappdUserURL + user,
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
            var venueNameFull = $('.user-info').find('.info').find('h1').text().trim().replace("'","");
            var venueUntappdURL = untappdUserURL + user;
            var venueUntappdLogoURL = $('.user-info').find('.avatar-holder').find('img').attr('src');

            var connection = mysql.createConnection(dbInfo.data);

            var beerList = [];
            $('#main-stream').find('.item').each(function(i,beer){
                beerList.push(beer);
            });
                    
            Promise.each(beerList,function (beer) {

                var beerInfo = {};            
                beerInfo.venueNameFull = venueNameFull;
                beerInfo.venueUntappdURL = venueUntappdURL;
                beerInfo.venueUntappdLogoURL = venueUntappdLogoURL;

                beerInfo.beertime = formatDate(new Date($(beer).find('.checkin').find('.feedback').find('.bottom').find('a.time.timezoner.track-click').text()));
                beerInfo.beerUntappdURL = 'https://untappd.com' + $(beer).find('.checkin').find('.top').find('a').attr('href');
                beerInfo.beerLogoURL = $(beer).find('.checkin').find('.top').find('a').find('img').attr('data-original');

                //get checkin details
                beerInfo.prices = $(beer).find('.checkin').find('.comment-text').text().trim();

                var checkinData = [];
                $(beer).find('.checkin').find('.top').find('p').find('a').each(function(i,item) {
                    checkinData.push($(item).text());
                });
                //console.log('checkin:',checkinData)
                beerInfo.name = checkinData[1].trim().replace("'","");
                beerInfo.brewery = checkinData[2].trim().replace("'","");
                beerInfo.index = 0;
                beerInfos.push(beerInfo);

            }).then(function(){
                console.log('Found ' + beerInfos.length + ' items for ' + beerInfos[0].venueNameFull);

                async.each(beerInfos, function (beerInfo, callback) {
                    //console.log(beerInfo)

                    var checkRecordsSQL = "SELECT * FROM `" + untappdTableName  + "` WHERE beertime='" + beerInfo.beertime + "' AND venue='" + beerInfo.venueNameFull + "'";  
                    //console.log('SQL: ' + checkRecordsSQL);

                    connection.query(checkRecordsSQL, function(err, rows, fields){
                        if(!err){
    
                            //if there are no hits, add it
                            if (rows.length === 0) {
                                logger.info('Need to add this beer or update index: ' + beerInfo.name + beerInfo.venueNameFull + beerInfo.index);

                                //go to beer page to get rating
                                var options = {
                                    uri: beerInfo.beerUntappdURL,
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
                                    beerInfo.rating = parseFloat($('.details').find('.rating').find('.num').text().replace(/\(|\)/g, ""));
                                    beerInfo.ABV = $('.details').find('.abv').text().replace('ABV','').trim();
                                    beerInfo.IBU = $('.details').find('.ibu').text().replace(' IBU','').trim();
                                    if (beerInfo.IBU === 'No') beerInfo.IBU = 'N/A';
                                    beerInfo.style = $('.top').find('.name').find('.style').text();

                                    console.log('DATE',beerInfo.beertime)
                                    
                                    var insertBeerSQL = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerLogoURL,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL) VALUES ('" + beerInfo.beertime + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerLogoURL + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "')";
            
                                    connection.query(insertBeerSQL, function(err, rows, fields){
                                        if(!err){
                                            logger.warn("Added untappd item: " + beerInfo.venueNameFull + beerInfo.brewery + beerInfo.name);
                                            callback(null);
                                        } else {
                                            console.log("Error while performing Query" + beerInfo.venueNameFull + ' | ' + beerInfo.brewery + ' | ' + beerInfo.name);
                                            callback(err);
                                        }
                                    });
                                })
                                .catch(function (err) {
                                    logger.error('There was an error getting the user from untappd for: ' + user);
                                });
                            }
                            //otherwise 
                            else {
                                logger.info('Untappd user item already exists: ' + beerInfo.venueNameFull + beerInfo.brewery + beerInfo.name);
                                callback(null);
                            }
                        } else {
                            logger.error(err);
                            callback(err);
                        }

                    });
                }, function(err){
                    if(err){
                        logger.error(err);
                        connection.end();
                    }else{
                        console.log('finally done');
                        connection.end();
                        resolve(beerInfos);
                    }
                });
            });

    
        }).catch(function (err) {
            logger.error('There was an error getting the user from untappd for: ' +  user);
        });
    });
};

exports.cleanupInstagram = function() {

    return new Promise(function(resolve, reject){

        var createTableSQL = "CREATE TABLE IF NOT EXISTS `" + instagramTableName + "` (uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY, beertime DATETIME,user TEXT(100),venue TEXT(100),text VARCHAR(2200) COLLATE utf8_general_ci,venueLogoURL TEXT(200),thumbnailURL TEXT(200),imageURL TEXT(200))";

        var cleanupSQL = "DELETE FROM `" + instagramTableName + "` WHERE beertime < NOW() - INTERVAL " + daysToExpire + " DAY";

        Database.execute( dbInfo.data,
            //first query checks if database exists if not creates it
            database => database.query(createTableSQL)
            //second query cleans up old records in database
            .then( rows => {
                return database.query(cleanupSQL);
            } )
        ).then( () => {
            resolve({"result": "Finished instagram DB cleanup"});

        }).catch( err => {
            console.log('there was an error',err)
        });
    });
};

exports.instagramByUser = function(user) {

    return new Promise(function(resolve, reject){
        if (!user) return reject(new Error('Argument "user" must be specified'));

        var options = {
            url: instagramURL + user,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4',
                "encoding": "text/html;charset='charset=utf-8'"
            }
        };
        
        request(options, function(err, response, body){
            if (err) return reject(err);
    
            var dataString = body.match(dataExp)[1];
            var data = JSON.parse(dataString);
            if (data) {
                           
                var edges = data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;
                var venue = data.entry_data.ProfilePage[0].graphql.user.full_name;
                if (venue === '𝖱𝖮𝖮𝖳 + 𝖡𝖱𝖠𝖭𝖢𝖧 𝖡𝖱𝖤𝖶𝖨𝖭𝖦') venue = 'ROOT + BRANCH BREWING';
                var venueLogo = data.entry_data.ProfilePage[0].graphql.user.profile_pic_url;

                async.waterfall([
                    function (callback) {
                        var medias = [];

                        for (i = 0; i < numInstagramPosts; i++) { 
                            var post = edges[i];

                            if (post.node.edge_media_to_caption.edges[0]) {

                                //clean up hashtags and mentions from text
                                var regexp1 = /\#\w\w+\s?/g;
                                var regexp2 = /\@\w\w+\s?/g;
                                var text = post.node.edge_media_to_caption.edges[0].node.text.split();
        
                                medias.push({
                                    user: user,
                                    venue: venue.replace(/'/g, ""),
                                    venueLogoURL: venueLogo,
                                    text : text[0].replace(/[\u0800-\uFFFF]/g, '').replace(/\n/g,' ').replace(/'/g, ""),
                                    thumbnailURL : post.node.thumbnail_resources[3].src,
                                    imageURL : post.node.display_url,
                                    date : new Date(post.node.taken_at_timestamp * 1000).toLocaleString()
                                });

                                //console.log('testest',post.node.taken_at_timestamp, formatDate(new Date(post.node.taken_at_timestamp * 1000)))
                            }
                        }
                        callback(null, medias);
                    }    
                ], function (err, results) {
                        var response = {
                            total : results.length,
                            medias : results
                        };

                        var connection = mysql.createConnection(dbInfo.data);
                        async.each(results, function (item, callback) {

                            //only process if less than 7 days old
                            var weekInMilliseconds = daysToExpire * 24 * 60 * 60 * 1000;
                            var now = new Date();
                            var postDate = Date.parse(item.date);

                            if ((now - postDate) < weekInMilliseconds) {
                                //console.log('POST IS NEWER THAN ONE WEEK');

                                var checkRecordsSQL = "SELECT * FROM `" + instagramTableName  + "` WHERE user='" + item.user + "' AND beertime='" + item.date + "'"; 
                                connection.query(checkRecordsSQL, function(err, rows, fields){
                                    if(!err){
        
                                        //if there are no hits, add it
                                        if (rows.length === 0) {

                                            console.log("DATE",item.date);
    
                                            //write to database
                                            var insertPostSQL = "INSERT INTO `" + instagramTableName  + "` (beertime,user,venue,text,venueLogoURL,thumbnailURL,imageURL) VALUES ('" + formatDate(item.date) + "','" + item.user + "','" + item.venue + "','" + item.text + "','" + item.venueLogoURL + "','" + item.thumbnailURL + "','" + item.imageURL + "')";
    
                                            //console.log('SQL', insertPostSQL);
    
                                            connection.query(insertPostSQL, function(err, rows, fields){
                                                if(!err){
                                                    logger.warn("Inserted Instagram item: " + item.user);
                                                    callback(null);
                                                } else {
                                                    console.log("Error while performing Instagram Query: " + item.user + ' | ' + item.venue);
                                                    callback(err);
                                                }
                                            });
                                        }
                                        //otherwise 
                                        else {
                                            //logger.info('This instagram post already exists: ' + item.user);
                                            callback(null);
                                        }
                                    } else {
                                        logger.error(err);
                                        callback(err);
                                    }
                                });
                            }

                            //post was older than one week
                            else {
                                logger.info('This instagram post was older than one week: ' + item.user + ' ' + item.date);
                                callback(null);
                            }

                        }, function(err){
                            if(err){
                                logger.error('HERE',err);
                                connection.end();
                            }else{
                                console.log('finally done');
                                connection.end();
                                resolve(response); 
                            }
                        }); 
                });
            }
            else {
                reject(new Error('Error scraping tag page "' + tag + '"'));
            }
        });
    });
};

exports.cleanupTwitter = function() {

    return new Promise(function(resolve, reject){

        var createTableSQL = "CREATE TABLE IF NOT EXISTS `" + twitterTableName + "` (uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY, beertime DATETIME,user TEXT(100),venue TEXT(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,text VARCHAR(2200) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,userPhotoURL TEXT(200),imageURL TEXT(200)) CHARACTER SET utf8 COLLATE utf8_general_ci";

        var cleanupSQL = "DELETE FROM `" + twitterTableName  + "` WHERE beertime < NOW() - INTERVAL " + daysToExpire + " DAY";

        //set DB charset for emojis, error without this
        dbInfo.data.charset = 'utf8mb4';

        Database.execute( dbInfo.data,
            //first query checks if database exists if not creates it
            database => database.query(createTableSQL)
            //second query cleans up old records in database
            .then( rows => {
                return database.query(cleanupSQL);
            } )
        ).then( () => {
            resolve({"result": "Finished twitter DB cleanup"});

        }).catch( err => {
            console.log('there was an error',err)
        });
    });
};

exports.getTwitterByUser = function(user) {

    return new Promise(function(resolve, reject){
        if (!user) return reject(new Error('Argument "user" must be specified'));
    
        //console.log('starting twitter scrape',user);

        //first get twitter profile so we can get user logo
        var twitterProfile = new scrapetwitter.getUserProfile(user);
        
        twitterProfile.then(function(profile){
            //console.log('profile',profile);

            //then get tweets
            var tweetData = [];
            var twitterStream = new scrapetwitter.TimelineStream(user,{retweets:false,replies:false,count:numTweets});

            twitterStream.on('data', function(tweet) {
                console.log('results',numTweets);
                numTweets -=1;
                tweetData.push(tweet);
                //console.log(tweet);
            });

            twitterStream.on('end', function() {
                console.log('done getting twitter stream');

                var connection = mysql.createConnection(dbInfo.data);

                async.each(tweetData, function (tweet, callback) {
                    //console.log(tweet);

                    var checkRecordsSQL = "SELECT * FROM `" + twitterTableName  + "` WHERE beertime='" + formatDate(new Date(tweet.time))  + "' AND user='" + tweet.screenName + "'";  
                    //console.log('SQL: ' + checkRecordsSQL);

                    connection.query(checkRecordsSQL, function(err, rows, fields){
                        if(!err){

                            //if there are no hits, add it
                            if (rows.length === 0) {

                                //logger.info('Need to add this tweet: ' + tweet.text);
                                //console.log(tweet.time,new Date(tweet.time).toLocaleString('en-US'), formatDate(new Date(tweet.time)));

                                var insertTweetSQL = "INSERT INTO `" + twitterTableName  + "` (beertime,user,venue,text,userPhotoURL,imageURL) VALUES ('" + formatDate(new Date(tweet.time)) + "','" + tweet.screenName + "','" + profile.name + "','" + tweet.text.replace("'","").replace("'","") + "','" + profile.profileImage + "','" + tweet.images[0] + "')";

                                console.log('SQL', insertTweetSQL)

                                connection.query(insertTweetSQL, function(err, rows, fields){
                                    if(!err){
                                        logger.warn("Added tweet: "  + tweet.text);
                                        callback(null);
                                    } else {
                                        console.log("Error while performing Query");
                                        callback(err);
                                    }
                                });
                    
                            }
                            //otherwise 
                            else {
                                logger.info('Twiter post already exists: ' + tweet.text);
                                callback(null);
                            }
                        } else {
                            logger.error(err);
                            callback(err);
                        }

                    });
                }, function(err){
                    if(err){
                        logger.error(err);
                        connection.end();
                    }else{
                        console.log('finally done');
                        connection.end();
                        resolve(null);
                    }
                });
            });
        });        
    });
};


function formatDate(d) {
    return (d.getFullYear() + "-" + ("00" + (d.getMonth() + 1)).slice(-2)) + "-" + ("00" + d.getDate()).slice(-2) + " " + ("00" + d.getHours()).slice(-2) + ":" + ("00" + d.getMinutes()).slice(-2) + ":" + ("00" + d.getSeconds()).slice(-2);
}
