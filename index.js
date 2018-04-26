var rp = require('request-promise');
var cheerio = require('cheerio');
var mysql = require('promise-mysql');

var dbInfo = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'localjuicefeed'
};
var connection;

exports.getUntappdMenu = function(venue) {
    var untappdURL = 'https://untappd.com/v/';

    //create table if it doesnt exist
    mysql.createConnection(dbInfo).then(function(conn){
        connection = conn;
        var sql = "CREATE TABLE IF NOT EXISTS `" + venue + "` (beertime DATETIME,idx INT,name VARCHAR(100) NOT NULL PRIMARY KEY,ABV TEXT(10),IBU TEXT(10),brewery TEXT(100),style TEXT(100),untappdLink TEXT(100),prices TEXT(100))";
        var result = conn.query(sql);
        conn.end();
        console.log("Table created for:",venue);
        return result;
    }).catch(function(error){
        if (connection && connection.end) connection.end();
        //logs out the error
        console.log(error);
    });

    //options for page scrape request
    var options = {
        uri: untappdURL + venue,
        transform: function (body) {
            return cheerio.load(body);
        }
    };

    //start request promise
    rp(options)
    .then(function ($) {

        var beerInfos = [];

        $('.menu-section-list').find('li').each(function(i,beer){

            //console.log("BEER",$(beer).find('.beer-details').text())

            //get beer details
            var beerInfo = {};
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
            beerInfos.push(beerInfo);

            //write to database
            mysql.createConnection(dbInfo).then(function(conn){
                connection = conn;
                var sql = "INSERT INTO `" + venue + "` (beertime,idx,name,ABV,IBU,brewery,style,untappdLink,prices) VALUES ('" + new Date().toLocaleString() + "','" + beerInfo.index + "','" + beerInfo.name + "','" + beerInfo.ABV + "','" + beerInfo.IBU + "','" + beerInfo.brewery + "','" + beerInfo.style + "','" + beerInfo.untappdLink + "','" + beerInfo.prices + "') ON DUPLICATE KEY UPDATE idx='" + beerInfo.index + "'";

                //console.log('SQL',sql)
        
                var result = conn.query(sql);
                conn.end();
                console.log("Record inserted for:",beerInfo.name);
                return result;
            }).catch(function(error){
                if (connection && connection.end) connection.end();
                //logs out the error
                console.log(error);
            });
        });    
    })    
    .catch(function (err) {
        console.log(err);
    });
}