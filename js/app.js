/******
 * App 
 ******/
App = Ember.Application.create({
  LOG_TRANSITIONS: true,
  ready: function() {
    console.log('App ready.')    
  }
});

App.ApplicationAdapter = DS.FirebaseAdapter.extend({
  firebase: new Firebase('https://<yourfirebase>.firebaseio.com')
});


/*********
 * Models 
 *********/

App.Team = DS.Model.extend({
  name:           DS.attr('string'),
  group:          DS.attr('string'),

  flag: function() {
    return 'img/' + this.get('id') + '.png';
  }.property()

});

App.Match = DS.Model.extend({
  date:  DS.attr('number'),
  home: DS.belongsTo('team', { async: true }),
  homeGoals: DS.attr('number'),
  visitor: DS.belongsTo('team', { async: true }),
  visitorGoals: DS.attr('number'),
  matchDate: function() {
    return moment(this.get('date')).format('MMMM Do, h:mm:ss a');
  }.property('date')
});

/*********
 * Routes
 *********/
App.Router.map(function() {
  this.resource('teams', { path: '/teams' });
  this.resource('matches', { path: '/matches' });
});

/********
 * Index
 ********/
App.IndexRoute = Ember.Route.extend({
  redirect: function() {
    this.transitionTo('teams');
  }
});

/********
 * Teams
 ********/
App.TeamsRoute = Ember.Route.extend({
  model: function() {
    return this.store.findAll('team');
  }
});

App.TeamsController = Ember.ArrayController.extend({
  sortProperties: ['group, name'],
  sortAscending: true
});

/**********
 * Matches
 **********/
App.MatchesRoute = Ember.Route.extend({
  model: function() {
    return this.store.findAll('match');
  }
});

App.MatchesController = Ember.ArrayController.extend({
  sortProperties: ['date'],
  sortAscending: true
});


