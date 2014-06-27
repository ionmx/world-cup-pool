/*********
 * Utils
 *********/
function getOrdinal(n) {
   var s=["th","st","nd","rd"],
       v=n%100;
   return n+'<sup>'+(s[(v-20)%10]||s[v]||s[0])+'</sup>';
}

function getWinner(home, visitor) {
  if (home > visitor) {
    winner = 'home';
  } else if (home < visitor) {
    winner = 'visitor';
  } else {
    winner = 'tied';
  }
  return winner;
}

function getScore(home, visitor, homePrediction, visitorPrediction) {
  var points = 0;
  if (home >= 0) {
    if ( (home == homePrediction) && (visitor == visitorPrediction) ) {
      points = 15;
    } else if (getWinner(home, visitor) == getWinner(homePrediction, visitorPrediction)) {
      points = 10 - Math.abs(homePrediction - home) - Math.abs(visitorPrediction - visitor);
      if (points < 0) { points = 0; }
    }
  }
  if (isNaN(points)) {
    points = 0;
  }
  return points;
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
    this.inject('component', 'auth', 'main:auth');
  }

});

var firebaseRef = new Firebase('https://ionwcfinals.firebaseio.com');

App.ApplicationAdapter = DS.FirebaseAdapter.extend({
  firebase: firebaseRef
});

App.ApplicationRoute = Ember.Route.extend({
  init: function() {
    var auth = this.get('auth');
    auth.store = this.get('store');
  }, 
  renderTemplate: function() {
    this.render();
    this.render('users', {
      into: 'application',
      outlet: 'ranking',
      controller: 'Users',
      model: this.store.find('user')
    });
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
  viewUserID: '',
  init: function() {
    self = this;
    Ember.RSVP.hash({
      matches: this.store.find('match'),
    }).then(function(promises){
      self.set('matchesCache', promises.matches);
    }.bind(this));
  }
});

/********
 * Auth 
 *******/
App.AuthController = Ember.Controller.extend({
  needs: ['application'],
  authed: false,
  currentUser: null,

  init: function() {
    var self = this;
    this.authClient = new FirebaseSimpleLogin(firebaseRef, function(error, userTwitter) {
      if (error) {
        alert('Authentication failed: ' + error);
      } else if (userTwitter) {  
        self.set('controllers.application.viewUserID', userTwitter.username);
        self.set('authed', true);
        self.store.find('user', userTwitter.username).then(function(user) {
          self.set('currentUser', user);
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
            self.set('currentUser', u);
            self.set('controllers.application.viewUserID', u.id);
            // Add empty predictions...
            self.store.find('match').then(function(matches) {
              matches.forEach(function(m) {
                var predProperties = {
                  'id': [u.id, '_', m.id].join(''),
                  'date': new Date().getTime(),
                  'homePrediction': null,
                  'visitorPrediction': null,
                };
                var p = self.store.createRecord('prediction', predProperties);
                p.save().then(function() {
                  u.get('predictions').then(function(predictions) {
                    predictions.addObject(p);
                    u.save();
                  });
                });
              });
            });

          });

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
  score:        DS.attr('number'),
  predictions:  DS.hasMany('prediction', { inverse: 'user', async: true }), 
  twitterUrl: function() {
    return 'http://twitter.com/' + this.get('id');
  }.property()
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
  date:              DS.attr('number'),
  user:              DS.belongsTo('user', { async: true }),
  homePrediction:    DS.attr('number'),
  visitorPrediction: DS.attr('number'),
});

/*********
 * Router
 *********/
App.Router.map(function() {
  this.resource('user', { path: '/user/:user_id' });
});

/********
 * Index
 ********/
App.IndexRoute = Ember.Route.extend({
  model: function() {
    return Ember.RSVP.hash({
      matches: this.store.find('match')
    });
  }
});

/**********
 * Matches
 **********/
App.MatchController = Ember.ObjectController.extend({
  needs: ['application'],
  
  isEditable: function() {
    var msBefore = 7200000;  // Two hours before
    var now = new Date().getTime();
    return (this.get('auth.authed') && 
            this.get('isVisible') &&
            (this.get('date') - now) > msBefore &&
            this.get('controllers.application.viewUserID') == this.get('auth.currentUser.id'));
  }.property('date', 'isVisible', 'controllers.application.viewUserID', 'auth.currentUser'),

  isVisible: function() {
    return ((this.get('home').get('id') != 'null') &&
            (this.get('visitor').get('id') != 'null'));
  }.property('home.id', 'visitor.id'),

  userPoints: function() {
    return getScore(this.get('homeGoals'),
                    this.get('visitorGoals'),
                    this.get('prediction.homePrediction'),
                    this.get('prediction.visitorPrediction'));
  }.property('model', 'homeGoals', 'visitorGoals', 'prediction.homePrediction', 'prediction.visitorPrediction'),

  homeGoalsDisplay: function() {
    return (this.get('homeGoals') >= 0) ? this.get('homeGoals') : '';
  }.property('homeGoals'),

  visitorGoalsDisplay: function() {
    return (this.get('visitorGoals') >= 0) ? this.get('visitorGoals') : '';
  }.property('visitorGoals'),

  prediction: function() {
    var id = [this.get('controllers.application.viewUserID'),'_',this.get('id')].join('');
    return this.store.find('prediction', id);
  }.property('model','controllers.application.viewUserID'),

  homePredictionDisplay: function() { 
    return (this.get('prediction.homePrediction') >= 0) ? this.get('prediction.homePrediction') : '-';
  }.property('prediction.homePrediction'),

  visitorPredictionDisplay: function() { 
    return (this.get('prediction.visitorPrediction') >= 0) ? this.get('prediction.visitorPrediction') : '-';
  }.property('prediction.visitorPrediction'),

  gameClass: function() {
    return 'game-' + this.get('id');
  }.property('id'),

  actions: {
    updatePrediction: function(goals) {
      this.get('prediction').then(function(prediction) {
        prediction.set('date', new Date().getTime());
        prediction.save().then(
          // Success
          function() {
            console.log('Prediction ' + prediction.get('id') + ' updated');
          },
          // Fail
          function() {
            alert('Error');
          } 
        );
      });
    }
  }

});

/*******
 * User 
 *******/
App.UserRoute = Ember.Route.extend({
  setupController: function(controller, model) {
    controller.set('model', model);
    this.controllerFor('application').set('viewUserID', model.get('id'));
  }
});

App.UserController = Ember.ObjectController.extend({
  needs: ['application'],
  matches: function() {
    return this.store.find('match');
  }.property('model')
});

App.UsersController = Ember.ArrayController.extend({
  itemController: 'user',
  sortProperties: ['score'],
  sortAscending: false,
  highScores: function() {
    var pos = 0;
    var previous = 0;
    return this.get('arrangedContent').map(function(i, idx) {
      if (i.get('score') != previous) {
        pos += 1;
        previous = i.get('score');
      }
      i.set('position', pos);
      i.set('positionOrdinal', getOrdinal(pos));
      i.set('positionClass', 'position-' + i['position']);
      return i;
    });
  }.property('@each')
});
