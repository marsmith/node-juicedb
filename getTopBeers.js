var mysql = require('promise-mysql');
var dbInfo = require('./dbInfo.js');

var tableName = 'untappd';

//check if we have this beer already at this venue
mysql.createConnection(dbInfo.data).then(function(conn){
    connection = conn;
    var sql = "SELECT * FROM `" + tableName + "` WHERE rating>4.0 ORDER BY rating DESC";     
    return conn.query(sql);
}).then(function(rows){
    rows = JSON.parse(JSON.stringify(rows));
    rows.forEach(function (item) {
        console.log(item.rating,item.name,item.brewery,'at',item.venue.split('/')[0]);
    });
    connection.end();
}).catch(function(error){
    if (connection && connection.end) connection.end();
    //logs out the error
    console.log(error);
});