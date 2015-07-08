apos.widgetPlayers.twitter = function($widget) {
  var widgetData = apos.getWidgetData($widget);

  $.post('/apos-twitter/feed', widgetData)
  .done(function(data) {
    $('[data-apos-twitter-contents]').html(data).addClass('loaded');
    $widget.trigger('aposTwitterReady');    
  });
};
