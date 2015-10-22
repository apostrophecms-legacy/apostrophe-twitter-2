var extend = require('extend');
var twitter = require('simple-twitter');
var _ = require('lodash');
var qs = require('qs');
var moment = require('moment');

module.exports = function(options, callback) {
  return new Construct(options, callback);
};

module.exports.Construct = Construct;

function Construct(options, callback) {
  var apos = options.apos;
  var app = options.app;
  if (!options.consumerKey) {
    console.error('WARNING: you must configure the consumerKey, consumerSecret, accessToken and accessTokenSecret options to use the Twitter widget.');
  }
  var consumerKey = options.consumerKey;
  var consumerSecret = options.consumerSecret;
  var accessToken = options.accessToken;
  var accessTokenSecret = options.accessTokenSecret;

  // How long to cache the feed, in seconds. Twitter's API rate limit is
  // rather generous at 300 requests per 15 minutes. We shouldn't get anywhere
  // near that, we'd make 30 requests. However with clustering we would have
  // separate caches and this might start to look like the right setting.

  var cacheLifetime = options.cacheLifetime || 30;
  var self = this;
  self._apos = apos;
  self._app = app;
  self._apos.mixinModuleAssets(self, 'twitter', __dirname, options);

  // This widget should be part of the default set of widgets for areas
  // (this isn't mandatory)
  apos.defaultControls.push('twitter');

  // Include our editor template in the markup when aposTemplates is called
  self.pushAsset('template', 'twitterEditor', { when: 'user' });

  // Make sure that aposScripts and aposStylesheets summon our assets
  self.pushAsset('script', 'content', { when: 'always' });
  self.pushAsset('script', 'editor', { when: 'user' });

  // give users an opt out of our styles
  if (!options.resetStyles) {
    self.pushAsset('stylesheet', 'content', { when: 'always' });
  }

  // Serve our feeds. Be sure to cache them so we don't hit the rate limit.
  var tweetCache = {};
  var url;

  app.post('/apos-twitter/feed', function(req, res) {
    var widgetOptions = req.body || {};
    var username = apos.sanitizeString((widgetOptions.account || ''));
    var hashtag = apos.sanitizeString((widgetOptions.hashtag || ''));
    var count = widgetOptions.limit || 5;

    if (username && !username.length) {
      res.statusCode = 404;
      return res.send('not found');
    }

    // ensure hashtags have hashtags and allow multiple (maybe)
    if (hashtag) {
      hashtag = _.map(hashtag.split(' '),function(s){
        return (s.substr(0,1) == '#') ? s : '#'+s;
      }).join(' ');
    }

    if (username && !hashtag) {
      url = 'statuses/user_timeline.json?' + qs.stringify({ screen_name: username, count: count });
    } else if (username && hashtag) {
      url = 'search/tweets.json?' + qs.stringify({ q: 'from:' + username + ' ' + hashtag, count: count });
    } else if (hashtag && !username) {
      url = 'search/tweets.json?' + qs.stringify({ q: hashtag, count: count });
    }

    if (_.has(tweetCache, url)) {
      var cache = tweetCache[url];
      var now = (new Date()).getTime();
      if (now - cache.when > cacheLifetime * 1000) {
        delete tweetCache[url];
      } else {

        var widgetData = {
          options: widgetOptions,
          tweets: cache.results
        }

        return res.send(self.render('widget', widgetData));
      }
    }

    var reader = new twitter(consumerKey, consumerSecret, accessToken, accessTokenSecret);

    return reader.get(url, function(err, results) {
      if (err) {
        results = '[]';
      }
      results = JSON.parse(results);
      if (results.statuses) {
        results = results.statuses;
      }
      tweetCache[url] = { when: (new Date()).getTime(), results: results };

      var widgetData = {
        options: widgetOptions,
        tweets: results
      }

      return res.send(self.render('widget', widgetData));
    });
  });

  self.widget = true;
  self.label = 'Twitter';
  self.css = 'twitter';
  self.icon = 'icon-twitter';

  self.sanitize = function(item) {
    if (item.account) {
      var matches = item.account.match(/\w+/);
      item.account = matches[0];
    }
  };

  self.renderWidget = function(data) {
    // render simple placeholder markup, which will later be replaced with tweets
    // see /views/widget.html for the template for the widget
    return self.render('placeholder', data);
  };

  self._apos.addWidgetType('twitter', self);

  self._apos.addLocal('linkifyTweetUrls', function(text) {
    return text.replace(/https?\:\/\/\S+/g, function(url) {
      var urlSansPeriod = url.replace(/\.$/, '');
      return '<a href="' + urlSansPeriod + '" target="blank">' + url + '</a>';
    });
  });

  self._apos.addLocal('getRelativeTime', function(datetime, noSuffix) {
    return moment(Date.parse(datetime)).fromNow(noSuffix);
  });

  return setImmediate(function() { return callback(null); });
}
