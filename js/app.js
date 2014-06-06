/******
 * App 
 ******/
App = Ember.Application.create({
  LOG_TRANSITIONS: true,

  ready: function() {
    this.register('main:auth', App.AuthController);
    this.inject('route', 'auth', 'main:auth');
    this.inject('controller', 'auth', 'main:auth');
  }

});

var firebaseRef = new Firebase('https://fifapool2014.firebaseio.com');

App.ApplicationAdapter = DS.FirebaseAdapter.extend({
  firebase: firebaseRef
});

App.ApplicationRoute = Ember.Route.extend({
  actions: {
    login: function() {
      this.get('auth').login();
    },

    logout: function() {
      this.get('auth').logout();
    }
  }
});

App.ApplicationController = Ember.Controller.extend({
});

/********
 * Auth 
 *******/
App.AuthController = Ember.Controller.extend({
  authed: false,
  currentUser: null,

  init: function() {
    this.authClient = new FirebaseSimpleLogin(firebaseRef, function(error, userTwitter) {
      if (error) {
        alert('Authentication failed: ' + error);
      } else if (userTwitter) {
        this.set('authed', true);
        var controller = this;

        // FIXME: This is a ugly hack, needs to get App store here 
        var store = App.get('Team.store'); 

        store.find('user', userTwitter.username).then(function(user) {
          controller.set('currentUser', user);
        }, function(reason) {
          // Create user...
          var properties = {
            id: userTwitter.username,
            name: userTwitter.username,
            displayName: userTwitter.displayName,
            avatarUrl: userTwitter.thirdPartyUserData.profile_image_url
          };
          var user = store.createRecord('user', properties);
          user.save();
          controller.set('currentUser', user);
        });
        
      } else {
        this.set('authed', false);
      }
    }.bind(this));
  },

  login: function() {
    this.authClient.login('twitter', { rememberMe: true });
  },

  logout: function() {
    this.authClient.logout();
  }

});


/*********
 * Models 
 *********/

App.User = DS.Model.extend({
  name:  DS.attr('string'),
  displayName:  DS.attr('string'),
  avatarUrl:  DS.attr('string'),
});

App.Team = DS.Model.extend({
  name:  DS.attr('string'),
  group: DS.attr('string'),

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


