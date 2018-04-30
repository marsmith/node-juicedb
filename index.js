var rp = require('request-promise');
var cheerio = require('cheerio');
var mysql = require('promise-mysql');
var request = require('request');
var Promise = require('bluebird');
var async   = require('async');
var { createLogger, format, transports } = require('winston');
var { combine, timestamp, label, prettyPrint } = format;
var dbInfo = require('./dbInfo.js');

var untappdTableName = 'untappd';
var instagramTableName = 'instagram';
var untappdURL = 'https://untappd.com/v/';
var instagramURL = 'https://www.instagram.com/';
var numInstagramPosts = 5;
dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;
var connection;

var logger = createLogger({
    level: 'warn',
    format: combine(
        timestamp(),
        prettyPrint()
    ),
    transports: [
        new transports.Console(),
        new transports.File({ filename: 'combined.log' })
    ]
});

exports.instagramByUser = function(user) {

    new Promise(function(resolve, reject){
        if (!user) return reject(new Error('Argument "user" must be specified'));
            var options = {
            url: instagramURL + user,
            headers: {
                'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4'
            }
            };
        request(options, function(err, response, body){
            if (err) return reject(err);
    
            var data = scrape(body)
            if (data) {
                           
                var edges = data.entry_data.ProfilePage[0].graphql.user.edge_owner_to_timeline_media.edges;
                var venue = data.entry_data.ProfilePage[0].graphql.user.full_name;
                var venueLogo = data.entry_data.ProfilePage[0].graphql.user.profile_pic_url;

                async.waterfall([
                    function (callback) {
                            var medias = [];
    
                            for (i = 0; i < numInstagramPosts; i++) { 
                                var post = edges[i];
        
                                //clean up hashtags and mentions from text
                                var regexp1 = /\#\w\w+\s?/g;
                                var regexp2 = /\@\w\w+\s?/g;
                                var text = post.node.edge_media_to_caption.edges[0].node.text.replace(regexp1, '').replace(regexp2, '').split();
        
                                medias.push({
                                    user: user,
                                    venue: venue,
                                    venueLogoURL: venueLogo,
                                    text : text,
                                    thumbnailURL : post.node.thumbnail_resources[3].src,
                                    imageURL : post.node.display_url,
                                     date : new Date(post.node.taken_at_timestamp * 1000).toLocaleString()
                                  });
                            }

                            callback(null, medias);
                    }    
                ], function (err, results) {
                        var response = {
                            total : results.length,
                            medias : results
                        }

                        //create table if it doesnt exist
                        mysql.createConnection(dbInfo.data).then(function(conn){
                            connection = conn;
                            var sql = "CREATE TABLE IF NOT EXISTS `" + instagramTableName + "` (uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY, beertime DATETIME,user TEXT(100),venue TEXT(100),text VARCHAR(500),venueLogoURL TEXT(200),thumbnailURL TEXT(200),imageURL TEXT(200))";
                            var result = conn.query(sql);
                            connection.end();
                            logger.info("Checking instagram for:" + user);
                            return result;
                        }).catch(function(error){
                            if (connection && connection.end) connection.end();
                            //logs out the error
                            logger.info(error);
                        });
                        
                        mysql.createConnection(dbInfo.data).then(function(conn){   
                            connection = conn;
                            var sql = "DELETE FROM `" + instagramTableName + "` WHERE beertime < NOW() - INTERVAL 14 DAY";
                            var result = connection.query(sql);
                            connection.end();
                            logger.info("Instgram posts older than 14 days cleaned up");
                            return result;
                        }).catch(function(error){
                            if (connection && connection.end) connection.end();
                            //logs out the error
                            logger.info(error);
                        }); 

                        response.medias.forEach(function (item) {
                            //logger.info(item)

                            //check if we have this beer already at this venue
                            mysql.createConnection(dbInfo.data).then(function(conn){
                                connection = conn;
                                var sql = "SELECT * FROM `" + instagramTableName  + "` WHERE user='" + item.user + "' AND text='" + item.text + "'";  
                                //logger.info('sql:' + sql)     
                                var result = conn.query(sql);
                                conn.end();
                                return result;
                            }).then(function(rows){
                                //logger.info('rows' + rows);
                                //if there are no hits, add it
                                if (rows.length === 0) {
                                    //write to database
                                    mysql.createConnection(dbInfo.data).then(function(conn){
                                        connection = conn;
                                        var sql = "INSERT INTO `" + instagramTableName  + "` (beertime,user,venue,text,venueLogoURL,thumbnailURL,imageURL) VALUES ('" + item.date + "','" + item.user + "','" + item.venue + "','" + item.text + "','" + item.venueLogoURL + "','" + item.thumbnailURL + "','" + item.imageURL + "')";

                                        //logger.info('SQL',sql);
                                
                                        var result = conn.query(sql);
                                        conn.end();
                                        logger.warn("Inserted Instagram item: " + item.user + item.text);
                                        return result;
                                    }).catch(function(error){
                                        if (connection && connection.end) connection.end();
                                        //logs out the error
                                        logger.error(error);
                                    });
                                }
                            }).catch(function(error){
                                if (connection && connection.end) connection.end();
                                //logs out the error
                                logger.error(error);
                            });
                        });

                        resolve(response)   
                });
            }
            else {
                reject(new Error('Error scraping tag page "' + tag + '"'));
            }
        })
    });
       
    
    //get instagram page data
    var scrape = function(html) {
        try {
            var dataString = html.match(dataExp)[1];
            var json = JSON.parse(dataString);
        }
        catch(e) {
            if (process.env.NODE_ENV != 'production') {
                console.error('The HTML returned from instagram was not suitable for scraping');
            }
            return null
        }
    
        return json;
    };
};

exports.getUntappdMenu = function(venue) {

    //create table if it doesnt exist
    mysql.createConnection(dbInfo.data).then(function(conn){
        connection = conn;
        var sql = "CREATE TABLE IF NOT EXISTS `" + untappdTableName  + "` (uid INT NOT NULL AUTO_INCREMENT PRIMARY KEY,beertime DATETIME,venue TEXT(100),idx INT,name VARCHAR(100),brewery TEXT(100),style TEXT(100),ABV TEXT(10),IBU TEXT(10),rating TEXT(10),prices TEXT(100),beerLogoURL TEXT(100),beerUntappdURL TEXT(100),venueUntappdURL TEXT(100),venueUntappdLogoURL TEXT(100))";
        //logger.info(sql);
        var result = conn.query(sql);
        connection.end();
        logger.info("Checking untappd: " + venue);
        return result;
    }).catch(function(error){
        if (connection && connection.end) connection.end();
        //logs out the error
        logger.error(error);
    });
    
    mysql.createConnection(dbInfo.data).then(function(conn){   
        connection = conn;
        var sql = "DELETE FROM `" + untappdTableName  + "` WHERE beertime < NOW() - INTERVAL 14 DAY";
        var result = connection.query(sql);
        connection.end();
        logger.info("Beers older than 14 days cleaned up for: " + venue);
        return result;
    }).catch(function(error){
        if (connection && connection.end) connection.end();
        //logs out the error
        logger.error(error);
    });

    //loop over venues
    var options = {
        uri: untappdURL + venue,
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
        var venueUntappdURL = 'https://untappd.com' + $('.header-details').find('.logo').find('a').attr('href');
        var venueUntappdLogoURL = $('.header-details').find('.logo').find('img').attr('src');

        $('.menu-section-list').find('li').each(function(i,beer){

            var beerInfo = {};            
            beerInfo.venueNameFull = venueNameFull;
            beerInfo.venueUntappdURL = venueUntappdURL;
            beerInfo.venueUntappdLogoURL = venueUntappdLogoURL;

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


            //check if we have this beer already at this venue
            mysql.createConnection(dbInfo.data).then(function(conn){
                connection = conn;
                var sql = "SELECT * FROM `" + untappdTableName  + "` WHERE idx=" + beerInfo.index + " AND venue='" + beerInfo.venueNameFull + "'";  
                //logger.info('sql: ' + sql)     
                var result = conn.query(sql);
                conn.end();
                return result;
            }).then(function(rows){
                //if there are no hits, add it
                if (rows.length === 0) {
                    logger.info('Need to add this beer or update index: ' + beerInfo.name + beerInfo.venueNameFull + beerInfo.index);

                    //write to database
                    mysql.createConnection(dbInfo.data).then(function(conn){
                        connection = conn;

                        var sql = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerLogoURL,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerLogoURL + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "')";

                        //logger.info('SQL: ' + sql)
                
                        var result = conn.query(sql);
                        conn.end();
                        logger.warn("Added untappd item: " + beerInfo.venueNameFull + beerInfo.brewery + beerInfo.name);
                        return result;
                    }).catch(function(error){
                        if (connection && connection.end) connection.end();
                        //logs out the error
                        logger.error(error);
                    });
                }

                //this beer at this index needs to be updated
                if (rows.length === 1) {

                    if (1===1) {
                        
                        var data = JSON.parse(JSON.stringify(rows[0]));
        
                        //chek if we have this entry already
                        if (data.idx === beerInfo.index && data.name === beerInfo.name && data.venue === beerInfo.venueNameFull) {
                            logger.info('Already exists in the DB at this venue at this index: ' + beerInfo.venueNameFull + data.idx,beerInfo.name);
                        }
                        //check if new beer at this index
                        if (data.idx === beerInfo.index && data.name !== beerInfo.name && data.venue === beerInfo.venueNameFull) {
                            logger.info('New beer at this venue and index: ' +  beerInfo.venueNameFull + beerInfo.index,beerInfo.name);

                            //write to database
                            mysql.createConnection(dbInfo.data).then(function(conn){
                                connection = conn;

                                var sql = "UPDATE `" + untappdTableName  + "` SET beertime='" + new Date().toLocaleString() + "',idx='" + beerInfo.index + "',name='" + beerInfo.name + "',brewery='" + beerInfo.brewery + "',style='" + beerInfo.style + "',ABV='" + beerInfo.ABV + "',IBU='" + beerInfo.IBU + "',rating='" + beerInfo.rating + "',prices='" + beerInfo.prices + "',beerLogoURL='" + beerInfo.beerLogoURL + "',beerUntappdURL='" + beerInfo.beerUntappdURL + "' WHERE idx='" + beerInfo.index + "' AND venue='" + beerInfo.venueNameFull + "'";

                                //logger.info('SQL: ' + sql);
                        
                                var result = conn.query(sql);
                                conn.end();
                                logger.warn("Updated untappd item: " + beerInfo.venueNameFull + beerInfo.index, beerInfo.name);
                                return result;
                            }).catch(function(error){
                                if (connection && connection.end) connection.end();
                                //logs out the error
                                logger.error(error);
                            });
                        }   
                    }

          
                }
                //otherwise need to loop
                if (rows.length > 1) {
                    var foundFlag = false;
                    rows.forEach(function (row) {
                        if (row.name === beerInfo.name) {
                            logger.info('Already exists in the DB at this venue at this index: ' + beerInfo.venueNameFull + beerInfo.index,beerInfo.name);
                            foundFlag = true;
                        }
       
                    });
                    if (!foundFlag) {
                        logger.warn('New beer at this venue (this venue doesnt use indexes): ' + beerInfo.venueNameFull + beerInfo.index,beerInfo.name);
 
                        //write to database
                        // mysql.createConnection(dbInfo.data).then(function(conn){
                        //     connection = conn;

                        //     var sql = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerUntappdURL,venueUntappdURL,venueUntappdLogoURL) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "') ON DUPLICATE KEY UPDATE idx='" + beerInfo.index + "'";

                        //     //logger.info('SQL: ' + sql)
                    
                        //     var result = conn.query(sql);
                        //     conn.end();
                        //     logger.info("Processed: " + beerInfo.brewery + beerInfo.name);
                        //     return result;
                        // }).catch(function(error){
                        //     if (connection && connection.end) connection.end();
                        //     //logs out the error
                        //     logger.error(error);
                        // });
                    }
                }


                //otherwise we need to get some new data
                // else {
                //     //go to beer page to get rating
                //     var options = {
                //         uri: beerInfo.untappdLink,
                //         headers: {
                //             'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 8_0 like Mac OS X) AppleWebKit/600.1.3 (KHTML, like Gecko) Version/8.0 Mobile/12A4345d Safari/600.1.4'
                //         },
                //         transform: function (body) {
                //             return cheerio.load(body);
                //         }
                //     };

                //     //start request promise
                //     rp(options)
                //     .then(function ($) {

                //         beerInfo.rating = $('.details > .rating > .num').text().replace(/"/g, "").replace(/'/g, "").replace(/\(|\)/g, "");
                //         if (beerInfo.rating === 'N/A')
                //         beerInfos.push(beerInfo);

                //         //write to database
                //         mysql.createConnection(dbInfo.data).then(function(conn){
                //             connection = conn;

                //             var sql = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,brewery,style,ABV,IBU,rating,prices,beerUntappdURL,venueNameUntappd,venueUntappdURL) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venueNameFull + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.prices + "','" + beerInfo.beerUntappdURL + "','" + beerInfo.venueUntappdURL + "','" + beerInfo.venueUntappdLogoURL  + "')";

                //             //logger.info('SQL: ' + sql)
                    
                //             var result = conn.query(sql);
                //             conn.end();
                //             logger.info("Processed: " + beerInfo.brewery + beerInfo.name);
                //             return result;
                //         }).catch(function(error){
                //             if (connection && connection.end) connection.end();
                //             //logs out the error
                //             logger.error(error);
                //         });
                //     })
                //     .catch(function (err) {
                //         logger.info('There was an error getting the beer details for: ' + beerInfo.name);
                //     });
                // }
            }).catch(function(error){
                if (connection && connection.end) connection.end();
                //logs out the error
                logger.error(error);
            });


        });    
    })    
    .catch(function (err) {
        logger.error('There was an error getting the menu from untappd for:',venue,err);
    });
}