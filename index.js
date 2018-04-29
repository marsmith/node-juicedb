var rp = require('request-promise');
var cheerio = require('cheerio');
var mysql = require('promise-mysql');
var request = require('request');
var Promise = require('bluebird');
var async   = require('async');
var dbInfo = require('./dbInfo.js');

var untappdTableName = 'untappd';
var instagramTableName = 'instagram';
var untappdURL = 'https://untappd.com/v/';
var instagramURL = 'https://www.instagram.com/';
var numInstagramPosts = 5;
dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;
var connection;

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
                                    media_id : post.node.id,
                                    shortcode : post.node.shortcode,
                                    text : text,
                                    comment_count : post.node.edge_media_to_comment,
                                    like_count : post.node.edge_liked_by,
                                    display_url : post.node.display_url,
                                    owner_id : post.node.owner.id,
                                    date : new Date(post.node.taken_at_timestamp * 1000).toLocaleString(),
                                    thumbnail_url : post.node.thumbnail_src,
                                    thumbnail_resource : post.node.thumbnail_resources
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
                            var sql = "CREATE TABLE IF NOT EXISTS `" + instagramTableName + "` (beertime DATETIME,venue TEXT(100),text VARCHAR(500) PRIMARY KEY,imageurl TEXT(200),thumbnailurl TEXT(200))";
                            var result = conn.query(sql);
                            connection.end();
                            console.log("Checking instagram for:",user);
                            return result;
                        }).catch(function(error){
                            if (connection && connection.end) connection.end();
                            //logs out the error
                            console.log(error);
                        });
                        
                        mysql.createConnection(dbInfo.data).then(function(conn){   
                            connection = conn;
                            var sql = "DELETE FROM `" + instagramTableName + "` WHERE beertime < NOW() - INTERVAL 14 DAY";
                            var result = connection.query(sql);
                            connection.end();
                            console.log("Instgram posts older than 14 days cleaned up");
                            return result;
                        }).catch(function(error){
                            if (connection && connection.end) connection.end();
                            //logs out the error
                            console.log(error);
                        }); 

                        response.medias.forEach(function (item) {
                            //write to database
                            mysql.createConnection(dbInfo.data).then(function(conn){
                                connection = conn;
                                var sql = "INSERT INTO `" + instagramTableName  + "` (beertime,venue,text,imageurl,thumbnailurl) VALUES ('" + item.date + "','" + item.user + "','" + item.text + "','" + item.display_url + "','" + item.thumbnail_url + "')  ON DUPLICATE KEY UPDATE thumbnailurl='" + item.thumbnail_url + "'";

                                //console.log('SQL',sql);
                        
                                var result = conn.query(sql);
                                conn.end();
                                console.log("Processed instagram:",item.user,item.text);
                                return result;
                            }).catch(function(error){
                                if (connection && connection.end) connection.end();
                                //logs out the error
                                console.log(error);
                            });
                        });

                        resolve(response)   
                        //console.log('HERE',results);
    
                })
                
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
        var sql = "CREATE TABLE IF NOT EXISTS `" + untappdTableName  + "` (beertime DATETIME,venue TEXT(100),idx INT,name VARCHAR(100) NOT NULL PRIMARY KEY,ABV TEXT(10),IBU TEXT(10),rating TEXT(10),brewery TEXT(100),style TEXT(100),untappdLink TEXT(100),prices TEXT(100))";
        var result = conn.query(sql);
        connection.end();
        console.log("Checking:",venue);
        return result;
    }).catch(function(error){
        if (connection && connection.end) connection.end();
        //logs out the error
        console.log(error);
    });
    
    mysql.createConnection(dbInfo.data).then(function(conn){   
        connection = conn;
        var sql = "DELETE FROM `" + untappdTableName  + "` WHERE beertime < NOW() - INTERVAL 14 DAY";
        var result = connection.query(sql);
        connection.end();
        console.log("Beers older than 14 days cleaned up",venue);
        return result;
    }).catch(function(error){
        if (connection && connection.end) connection.end();
        //logs out the error
        console.log(error);
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

        $('.menu-section-list').find('li').each(function(i,beer){

            //get beer details
            var beerInfo = {};
            beerInfo.venue = venue;
            var $beerDetailsH5 = $(beer).find('.beer-details').find('h5');
            var $beerDetailsH6 = $(beer).find('.beer-details').find('h6');
            
            //check for beers that dont have a number
            if ($beerDetailsH5.find('a').text().indexOf('.') != -1) {
                beerInfo.name = $beerDetailsH5.find('a').text().split('.')[1].trim().replace("'","");
                beerInfo.index = parseInt($beerDetailsH5.find('a').text().split('.')[0]);
            }
            else {
                beerInfo.name = $beerDetailsH5.find('a').text().trim().replace("'","");
                beerInfo.index = '0';
            }
            var beerDetails = $beerDetailsH6.find('span').text().split('•');
            beerInfo.ABV = beerDetails[0].replace('ABV','').trim();
            beerInfo.IBU = beerDetails[1].replace('IBU','').trim();
            beerInfo.brewery = beerDetails[2].trim().replace("'","");
            beerInfo.style = $beerDetailsH5.find('em').text().replace("'","");
            beerInfo.untappdLink = 'https://untappd.com' + $beerDetailsH5.find('a').attr('href');
            var prices = [];
            $(beer).find('.beer-prices').find('p').each(function(i,item){
                prices.push($(item).text().trim());
            });
            beerInfo.prices = prices.join('|');

            //check if we have this beer already at this venue
            mysql.createConnection(dbInfo.data).then(function(conn){
                connection = conn;
                var sql = "SELECT EXISTS(SELECT 1 FROM `" + untappdTableName  + "` WHERE name='" + beerInfo.name + "' AND venue='" + beerInfo.venue + "')";       
                var result = conn.query(sql);
                conn.end();
                return result;
            }).then(function(rows){
                var exists = parseInt(JSON.stringify(rows[0]).split(':')[1].replace('}',''));
                if (exists === 1) {
                    console.log('Already exists in the DB at this venue at this index:',beerInfo.name, beerInfo.index);
                }
                else {
                    //go to beer page to get rating
                    var options = {
                        uri: beerInfo.untappdLink,
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

                        beerInfo.rating = $('.details > .rating > .num').text().replace(/"/g, "").replace(/'/g, "").replace(/\(|\)/g, "");
                        if (beerInfo.rating === 'N/A')
                        beerInfos.push(beerInfo);

                        //write to database
                        mysql.createConnection(dbInfo.data).then(function(conn){
                            connection = conn;
                            var sql = "INSERT INTO `" + untappdTableName  + "` (beertime,venue,idx,name,ABV,IBU,rating,brewery,style,untappdLink,prices) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.venue + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.rating + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.untappdLink + "','" + beerInfo.prices + "') ON DUPLICATE KEY UPDATE idx='" + beerInfo.index + "'";

                            //console.log('SQL',sql)
                    
                            var result = conn.query(sql);
                            conn.end();
                            console.log("Processed:",beerInfo.brewery, beerInfo.name);
                            return result;
                        }).catch(function(error){
                            if (connection && connection.end) connection.end();
                            //logs out the error
                            console.log(error);
                        });
                    })
                    .catch(function (err) {
                        console.log('There was an error getting the beer details for:',beerInfo.name);
                    });
                }
            }).catch(function(error){
                if (connection && connection.end) connection.end();
                //logs out the error
                console.log(error);
            });


        });    
    })    
    .catch(function (err) {
        console.log('There was an error getting the menu from untappd for:',venue);
    });
}