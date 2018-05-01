var localjuice = require('./index');

var instagramUsers = ['troy_beverage'];

instagramUsers.forEach(function (item) {
    localjuice.instagramByUser(item).then(function(result){
        console.log('Finished ' + item);
    })
    .catch(function(err){
        console.log('there was an error');
    });
});

//localjuice.instagramByUser('troy_beverage');
