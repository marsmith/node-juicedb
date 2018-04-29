var localjuice = require('./index');

var instagramUsers = ['troy_beverage'];

instagramUsers.forEach(function (item) {
    localjuice.instagramByUser(item);
});

//localjuice.instagramByUser('troy_beverage');
