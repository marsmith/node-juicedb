var mysql = require('promise-mysql');

var tableName = 'juicetable'
var dbInfo = {
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'localjuicefeed'//,
    //socketPath: '/var/run/mysqld/mysqld.sock'

};

//check if we have this beer already at this venue
mysql.createConnection(dbInfo).then(function(conn){
    connection = conn;
    var sql = "SELECT * FROM `" + tableName + "` WHERE rating>4.0 ORDER BY rating DESC";     
    return conn.query(sql);
}).then(function(rows){
    rows = JSON.parse(JSON.stringify(rows));
    rows.forEach(function (item) {
        console.log(item);
    });
    connection.end();
}).catch(function(error){
    if (connection && connection.end) connection.end();
    //logs out the error
    console.log(error);
});