var request = require('request');
var Promise = require('bluebird');
var async   = require('async');


var userURL = 'https://www.instagram.com/';
var user = 'troy_beverage';
var numPosts = 5;
dataExp = /window\._sharedData\s?=\s?({.+);<\/script>/;


new Promise(function(resolve, reject){
    if (!user) return reject(new Error('Argument "user" must be specified'));
        var options = {
        url: userURL + user,
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
                (callback)=>{
                        var medias = [];

                        for (i = 0; i < numPosts; i++) { 
                        var post = edges[i];

                        //clean up hashtags and mentions from text
                        var regexp1 = /\#\w\w+\s?/g;
                        var regexp2 = /\@\w\w+\s?/g;
                        var text = post.node.edge_media_to_caption.edges[0].node.text.replace(regexp1, '').replace(regexp2, '').split();

                        medias.push({
                            media_id : post.node.id,
                            shortcode : post.node.shortcode,
                            text : text,
                            comment_count : post.node.edge_media_to_comment,
                            like_count : post.node.edge_liked_by,
                            display_url : post.node.display_url,
                            owner_id : post.node.owner.id,
                            date : post.node.taken_at_timestamp,
                            thumbnail : post.node.thumbnail_src,
                            thumbnail_resource : post.node.thumbnail_resources
                        })
                        }
                        callback(null, medias);
                }    
            ]
            , (err, results)=>{
                    var response = {
                        total : results.length,
                        medias : results
                    }
                    resolve(response)   
                    console.log('HERE',results);

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