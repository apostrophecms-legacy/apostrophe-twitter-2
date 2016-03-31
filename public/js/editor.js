// @class Editor for Twitter feed widgets

function AposTwitterWidgetEditor(options) {
  var self = this;

  if (!options.messages) {
    options.messages = {};
  }

  self.type = 'twitter';
  options.template = '.apos-twitter-editor';

  // Parent class constructor shared by all widget editors
  AposWidgetEditor.call(self, options);

  // Now we can override methods
  self.afterCreatingEl = function() {
    self.$account = self.$el.find('.apos-twitter-account');
    self.$account.val(self.data.account);
    self.$account.on('change', self.updateLists);

    self.$list = self.$el.find('.apos-twitter-list select');

    self.list = self.data.list;

    self.$hashtag = self.$el.find('.apos-twitter-hashtag');
    self.$hashtag.val(self.data.hashtag);

    self.$limit = self.$el.find('[data-apos-twitter-limit]');
    self.$limit.val(self.data.limit);

    setTimeout(function() {
      self.$account.focus();
      self.$account.setSelection(0, 0);
      self.updateLists();
    }, 500);
  };

  self.prePreview = getAccount;
  self.preSave = getAccount;

  self.updateLists = function() {
    var selectize = self.$list[0].selectize;
    var username = self.$account.val();
    if (!username) {
      selectize.clearOptions();
      selectize.load(function(callback) {
        return callback([ { label: 'Username Required', value: '' } ]);
      });
      return;
    }
    selectize.clear();
    selectize.clearOptions();
    selectize.load(function(callback) {
      $.jsonCall('/apos-twitter/get-lists', { username: username }, function(lists) {
        var data = [
          {
            label: 'NONE — SHOW USER TWEETS',
            value: ''
          }
        ].concat(_.map(lists, function(list) {
          return { label: list.name, value: list.id };
        }));
        // No return is deliberate
        callback(data);
        if (self.data.list || self.list) {
          selectize.addItem(self.data.list || self.list);
        }
        // selectize.refreshOptions();
        // self.$list.blur();
      });
    });
  };

  function getAccount(callback) {
    self.exists = (!!self.$account.val()) || (!!self.$hashtag.val());
    if (self.exists) {
      self.data.account = self.$account.val();
      self.data.list = self.$list.val();
      self.data.hashtag = self.$hashtag.val();
      self.data.limit = self.$limit.val();
    }
    return callback();
  }
}

AposTwitterWidgetEditor.label = 'Twitter';

apos.addWidgetType('twitter');
