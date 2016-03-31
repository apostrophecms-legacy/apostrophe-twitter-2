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


  app.post('/apos-twitter/feed', function(req, res) {
    var widgetOptions = req.body || {};
    var username = apos.sanitizeString((widgetOptions.account || ''));
    var hashtag = apos.sanitizeString((widgetOptions.hashtag || ''));
    var list = widgetOptions.list ? apos.slugify(apos.sanitizeString(widgetOptions.list)) : false;
    var count = widgetOptions.limit || 5;
    var url;

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

    var params;

    if (username && list) {
      url = 'lists/statuses';
      params = { list_id: list, count: count };
    } else if (username && !hashtag) {
      url = 'statuses/user_timeline';
      params = { screen_name: username, count: count };
    } else if (username && hashtag) {
      url = 'search/tweets';
      params = { q: 'from:' + username + ' ' + hashtag, count: count };
    } else if (hashtag && !username) {
      url = 'search/tweets';
      params = { q: hashtag, count: count };
    }

    return self.getTwitter(url, params, function(err, results) {
      if (err) {
        results = { statuses: [] };
      }
      return res.send(self.render('widget', {
        options: widgetOptions,
        tweets: results
      }));
    });
  });

  app.post('/apos-twitter/get-lists', function(req, res) {
    var username = self._apos.sanitizeString(req.body.username);
    var url = 'lists/ownerships';
    return self.getTwitter(url, { screen_name: username }, function(err, results) {
      if (err) {
        return res.send([]);
      } else {
        return res.send(results.lists);
      }
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

  self.getReader = function() {
    if (!self.reader) {
      self.reader = new twitter(consumerKey, consumerSecret, accessToken, accessTokenSecret);
    }
    return self.reader;
  };

  var tweetCache = {};

  self.getTwitter = function(url, params, callback) {
    params = params ? ('?' + qs.stringify(params)) : false;
    if (_.has(tweetCache, url + params)) {
      var cache = tweetCache[url + params];
      var now = (new Date()).getTime();
      if (now - cache.when > cacheLifetime * 1000) {
        delete tweetCache[url + params];
      } else {
        return callback(null, JSON.parse(cache.results));
      }
    }
    return self.getReader().get(url, params, function(err, results) {
      if (err) {
        console.error('error:', err);
        return callback(err);
      }
      tweetCache[url + params] = { when: (new Date()).getTime(), results: results };
      return callback(null, JSON.parse(results));
    });
  };

  return setImmediate(function() { return callback(null); });
}
