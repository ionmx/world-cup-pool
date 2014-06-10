/*********
 * Utils
 *********/
function calculateScore(match, prediction) {
  // TODO: Calculate this.
  return 1;
}

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
  init: function() {
    var auth = this.get('auth');
    auth.store = this.get('store');
  }, 
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
  init: function() {
    self = this;
    Ember.RSVP.hash({
      matches: this.store.find('match'),
      //predictions: this.store.find('prediction'),
    }).then(function(promises){
      self.set('matchesCache', promises.matches);
      //self.set('predictionsCache', promises.predictions);
    }.bind(this));
  }
});

/********
 * Auth 
 *******/
App.AuthController = Ember.Controller.extend({
  authed: false,
  currentUser: null,

  init: function() {
    self = this;
    this.authClient = new FirebaseSimpleLogin(firebaseRef, function(error, userTwitter) {
      if (error) {
        alert('Authentication failed: ' + error);
      } else if (userTwitter) {
        this.set('authed', true);
        var controller = this;

        self.store.find('user', userTwitter.username).then(function(user) {
          controller.set('currentUser', user);
        }, function(reason) {
          // Create user...
          var properties = {
            id: userTwitter.username,
            name: userTwitter.username,
            displayName: userTwitter.displayName,
            avatarUrl: userTwitter.thirdPartyUserData.profile_image_url
          };
          var u = self.store.createRecord('user', properties);
          u.save().then(function() {
            // Add empty predictions...
            // var matches = self.store.find('match');
            var predProperties = {
              'id': [u.id, '_', 1].join(''),
              'user': u,
              'match': 1,
              'homePrediction': 5,
              'visitorPrediction': 10,
            };
            var p = self.store.createRecord('prediction', predProperties);
            p.save().then(function() {
              Promise.cast(u.get('predictions')).then(function(predictions) {
                predictions.addObject(p);
                u.save().then(function() {}, function() {});
              });
            });
          });

          controller.set('currentUser', u);
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
  name:         DS.attr('string'),
  displayName:  DS.attr('string'),
  avatarUrl:    DS.attr('string'),
  predictions:  DS.hasMany('prediction', { inverse: 'user', async: true }),
 
  //score: function(){
  //  var preds = this.get('predictions');
  //  var ret = 0;
  //  preds.forEach(function(p){
  //    // TODO: Add rules
  //    ret += calculateScore(match, p);
  //  });
  //  return ret;
  //}.property('predictions.@each.homePrediction', 'predictions.@each.visitorPrediction')

});

App.Team = DS.Model.extend({
  name:  DS.attr('string'),
  group: DS.attr('string'),

  flag: function() {
    return 'img/' + this.get('id') + '.png';
  }.property()

});

App.Match = DS.Model.extend({
  date:         DS.attr('number'),
  home:         DS.belongsTo('team', { async: true }),
  homeGoals:    DS.attr('number'),
  visitor:      DS.belongsTo('team', { async: true }),
  visitorGoals: DS.attr('number'),
  
  matchDate: function() {
    return moment(this.get('date')).format('MMMM Do');
  }.property('date'),

  matchTime: function() {
    return moment(this.get('date')).format('h:mm a');
  }.property('date')

});

App.Prediction = DS.Model.extend({
  user:              DS.belongsTo('user', { async: true }),
  homePrediction:    DS.attr('number'),
  visitorPrediction: DS.attr('number'),
});

/*********
 * Router
 *********/
App.Router.map(function() {
  this.resource('teams', { path: '/teams' });
  this.resource('matches', { path: '/matches' });
  this.resource('user', { path: '/user/:user_id' });
});

/********
 * Index
 ********/
App.IndexRoute = Ember.Route.extend({
  model: function() {
    return Ember.RSVP.hash({
      matches: this.store.find('match'),
      users: this.store.find('user')
    });
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
  sortAscending: true,
  itemController: 'match'
});

App.MatchController = Ember.ObjectController.extend({
  displayScore: Ember.computed.gte('homeGoals', 0)
});

/*******
 * User 
 *******/
App.UserRoute = Ember.Route.extend({
});

App.UserController = Ember.ObjectController.extend({
  needs: ["application"]
});


