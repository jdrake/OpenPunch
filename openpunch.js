
function _OpenPunch(env, os) {
  
  // Global var to be filled with models, data, etc.
  var self = {
    env: env,
    os: os,
    hashes: {
      sessionId: 'openpunch:sessionId'
    },
    roles: [
      {
        value: 'participant',
        label: 'Participants',
        active: true
      },
      {
        value: 'tutor',
        label: 'Tutors',
        active: true
      },
      {
        value: 'parent',
        label: 'Parents',
        active: true
      },
      {
        value: 'guest',
        label: 'Guests',
        active: true
      }
    ]
  };

  var apiRoots = {
    dev: 'http://127.0.0.1:5000/api/',
    network: 'http://192.168.0.101:3032/api/',
    staging: 'http://dev.openpunchapp.com/api/',
    live: 'http://openpunchapp.com/api/'
  };

  self.apiRoot = apiRoots[self.env];


  // Hook into jquery
  // Use withCredentials to send the server cookies
  // The server must allow this through response headers
  $.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
    options.xhrFields = {
      withCredentials: true
    };
    jqXHR.setRequestHeader("X-Requested-With", "XMLHttpRequest");
  });

  /*
   * Base models and collections, depending on data source
   */
  
  var MongoModel = Backbone.Model.extend({
    idAttribute: '_id',
    parse: function(resp) {
      return resp.records ? resp.records[0] : resp;
    }
  });

  // Salesforce
  var SFModel = Backbone.Model.extend({
    idAttribute: 'Id'
  });
  
  var OpenPunchModel = MongoModel;
  
  var MongoCollection = Backbone.Collection.extend({
    parse: function(resp) {
      return resp.records || [];
    }
  });
  
  var SFCollection = Backbone.Collection.extend({
    parse: function(response) {
      return response.records;
    }
  });

  var OpenPunchCollection = MongoCollection;
  
  var BaseFormView = Backbone.View.extend({
    initialize: function() {
      _.bindAll(this, 'updateSuccess', 'updateError');
    },
    attributes: function() {
      return {
        id: this.options.idPrefix + ((this.model) ? this.model.id : this.cid),
        'class': this.options.idPrefix + 'page page hide'
      };
    },
    template: function() {
      return _.template($('#' + this.options.idPrefix + 'template').html());
    },
    events: {
      'click button[type=submit]': 'commitForm',
      'keyup': 'commitFormOnEnter'
    },
    render: function() {
      this.$el.html(this.template()(_.extend(this.model.toJSON(), self.helpers)));
      this.$el.find('.form-container').prepend(this.form.render().el);
      return this;
    },
    commitFormOnEnter: function(e) {
      if (e.keyCode === 13)
        this.commitForm(e);
    },
    commitForm: function(e) {
      e.preventDefault();
      var errors = this.form.commit();
      if (!errors) {
        this.model.save(this.form.model.toJSON(), {
          success: this.updateSuccess,
          error: this.updateError
        });
      }
    },
    updateSuccess: function() {
      this.model.trigger('show:modal');
    },
    updateError: function() {
      console.log(arguments);
    }
  });
  
  
  /*
   * Rendering helper functions
   */
  
  self.helpers = {
    eventTime: function(d) {
      return new XDate(d).toString('h:mmtt');
    },
    eventDate: function(dt) {
      var now = new XDate()
        , date = new XDate(dt)
        , y0 = now.getFullYear()
        , m0 = now.getMonth()
        , d0 = now.getDate()
        , y = date.getFullYear()
        , m = date.getMonth()
        , d = date.getDate()
        , delta = now.diffDays(date);
      if (delta < 2 && delta >= 0) {
        if (d===d0)
          return 'Today';
        else
          return 'Tomorrow';
      } else if (delta > -2 && delta <=0) {
        if (d===d0)
          return 'Today';
        else
          return 'Yesterday';
      } else {
        return date.toString('ddd MMM d, yyyy');
      }
    },
    eventTitle: function(name) {
      return _.string.prune(name, 25);
    },
    relativeTime: function(d) {
      var date = new XDate(d)
        , now = new XDate()
        , hrsAgo = date.diffHours(now)
        , minAgo = date.diffMinutes(now)
        , secAgo = date.diffSeconds(now);
      if (hrsAgo > 12)
        return date.toString('MMM d \'&middot\' h:mm tt');
      else if (hrsAgo > 1)
        return [Math.round(hrsAgo), (hrsAgo > 2) ? 'hours' : 'hour', 'ago'].join(' ');
      else if (minAgo > 1)
        return [Math.round(minAgo), (minAgo > 2) ? 'mins' : 'min', 'ago'].join(' ');
      else if (secAgo > 1)
        return [Math.round(secAgo), (secAgo > 2) ? 'secs' : 'sec', 'ago'].join(' ');
      else
        return 'just now';
    },
    datePickerFormats: {
      browser: {
        date: function(dt) {
          return new XDate(dt).toString('yyyy-MM-dd');
        },
        time: function(dt) {
          return new XDate(dt).toString('H:mm');
        },
        datetime: function(dt) {
          return new XDate(dt).toString('yyyy-MM-dd HH:mm');
        }
      },
      ios: {
        date: function(dt) {
          return new XDate(dt).toString('yyyy-MM-dd');
        },
        time: function(dt) {
          return new XDate(dt).toString('HH:mm');
        },
        datetime: function(dt) {
          return new XDate(dt).toISOString();
        }
      },
      android: {
        date: function(dt) {
          return new XDate(dt).toString('yyyy-MM-dd');
        },
        time: function(dt) {
          return new XDate(dt).toString('HH:mm');
        },
        datetime: function(dt) {
          return new XDate(dt).toISOString();
        }
      }
    },
    totalHours: function(hrs) {
      var h = Math.floor(hrs)
        , m = Math.floor((hrs-h)*60);
      return _.string.sprintf("%s h %s m", h, m);
    },
    money: function(v) {
      var d = parseFloat(v);
      if (d>=0)
        return _.string.sprintf('$%.2f', d);
      else
        return _.string.sprintf('-$%.2f', Math.abs(d));
    },
    simpleDate: function(dt) {
      return new XDate(dt).toString('MMM d');
    }
  };


  /*
  Filters for use in different list views
   */

  self.Filter = Backbone.Model.extend({
    idAttribute: 'value'
  });

  self.Filters = Backbone.Collection.extend({
    model: self.Filter,
    localStorage: new Backbone.LocalStorage("openpunch:filters")
  });

  self.FilterGroup = Backbone.Model.extend({
    activeValues: function() {
      return _.map(this.get('filters').where({active: true}), function(f) {
        return f.get('value');
      });
    },
    pass: function(model) {
      return _.indexOf(this.activeValues(), model.get(this.get('attr'))) !== -1;
    },
    isActive: function() {
      // Filter group is active if any filters are inactive
      return this.get('filters').any(function(f) {
        return f.get('active') === false;
      });
    }
  });

  self.FilterGroupRoles = self.FilterGroup.extend({
    defaults: {
      filters: new self.Filters(self.roles),
      attr: 'role'
    },
    initialize: function() {
      this.get('filters').each(this.syncFilter, this);
    },
    syncFilter: function(filter) {
      filter.fetch({
        error: function(model, resp) {
          if (resp === 'Record not found')
            model.save();
        }
      });
    }
  });

  self.FilterToggleView = Backbone.View.extend({
    tagName: 'button',
    attributes: function() {
      return {
        'data-toggle': 'button',
        'data-value': this.model.get('value'),
        'class': 'filter-button btn btn-block ' + (this.model.get('active') ? 'active btn-success' : '')
      };
    },
    events: {
      'click': 'toggleFilter'
    },
    initialize: function() {
      _.bindAll(this, 'toggleFilter');
      this.parent = this.options.parent;
    },
    render: function() {
      this.$el.text(this.model.get('label'));
      return this;
    },
    toggleFilter: function(e) {
      this.model.save('active', !this.model.get('active'));
      this.$el.toggleClass('btn-success', this.model.get('active'));
    }
  });

  /*
 Transaction
  */
  self.Transaction = OpenPunchModel.extend({
    defaults: function() {
      return {
        amount: 0,
        side: 'c', // [c]redit or [d]ebit
        type: 'Subscription Refill'
      };
    },
    ledgerAmount: function() {
      return this.get('amount') * ((this.get('side')==='c') ? 1 : -1);
    },
    amountClass: function() {
      var b = this.ledgerAmount();
      if (b > 0)
        return 'plus';
      else if (b < 0)
        return 'minus';
      else
        return '';
    },
    pastTransactions: function() {
      return this.collection.filter(function(t) {
        return new XDate(t.get('dtAdd'))<new XDate(this.get('dtAdd')) && t.get('contactId')===this.get('contactId');
      }, this);
    },
    newBalance: function() {
      return _.reduce(this.pastTransactions(), function(memo, t) {
        return memo + t.ledgerAmount();
      }, this.ledgerAmount());
    },
    event: function() {
      return (this.get('type')==='Event Fee' && this.get('eventId')) ? self.events.get(this.get('eventId')) : null;
    }
  });

  self.Transactions = OpenPunchCollection.extend({
    model: self.Transaction,
    url: self.apiRoot + 'transactions',
    comparator: function(model) {
      return -1 * new XDate(model.get('dtAdd')).getTime();
    }
  });

  self.transactions = new self.Transactions();

  
  /*
   * Contact
   */
  
  self.Contact = OpenPunchModel.extend({
    defaults: {
      role: 'participant'
    },
    firstLast: function() {
      return this.get('first') + ' ' + this.get('last');
    },
    firstLastInitial: function() {
      return this.get('first') + ' ' + this.get('last')[0] + '.';
    },
    actions: function() {
      return new self.Actions(self.actions.where({contactId: this.id}));
    },
    transactions: function() {
      return new self.Transactions(self.transactions.where({contactId: this.id}));
    },
    balance: function() {
      return this.transactions().reduce(function(memo, t) {
        return memo + t.ledgerAmount();
      }, 0.0);
    },
    balanceClass: function() {
      var b = this.balance();
      if (b > 0)
        return 'plus';
      else if (b < 0)
        return 'minus';
      else
        return '';
    },
    totalCheckIns: function() {
      return _.uniq(_.pluck(this.actions().where({status: 'in'}), 'eventId')).length;
    },
    totalTime: function() {
      var groups = this.actions().groupBy(function(action) {
        return action.get('eventId');
      });
      // dtOut - dtIn, Hours
      var tt = _.reduce(groups, function(memo, group) {
        if (group.length !== 2)
          return memo;
        else
          return memo + Math.abs(new XDate(group[1].get('dt')).diffHours(group[0].get('dt')));
      }, 0);
      return self.helpers.totalHours(tt);
    }
  });

  self.Contacts = OpenPunchCollection.extend({
    model: self.Contact,
    url: self.apiRoot + 'contacts',
    comparator: function(model) {
      return model.get('first') + ' ' + model.get('last');
    }
  });
  
  self.contacts = new self.Contacts();
   
  
  /*
   * Event
   */
  
  self.Event = OpenPunchModel.extend({
    defaults: {
      cost: 5
    },
    parse: function(model) {
      model.attendees = new self.Attendees(model.attendees || [], {eventId: model._id});
      return model;
    },
    allActions: function() {
      return new self.Actions(self.actions.filter(_.bind(function(action) {
        // This event, and contact still exists
        return action.get('eventId') === this.id && self.contacts.get(action.get('contactId'));
      }, this)));
    },
    status: function() {
      var start = new XDate(this.get('dtStart'))
        , end = new XDate(this.get('dtEnd'))
        , now = new XDate()
        , dStart = start.diffMinutes(now)
        , dEnd = end.diffMinutes(now);
      if (dStart < 0 && dEnd < 0)
        return 'future';
      else if (dStart > 0 && dEnd > 0)
        return 'past';
      else
        return 'live';
    },
    totalAttendees: function() {
      var checkIns = this.allActions().where({status: 'in'})
        , contactIds = _.map(checkIns, function(action){ return action.get('contactId'); })
        , uniqIds = _.uniq(contactIds);
      return uniqIds.length;
    },
    lastAttendeeName: function() {
      var actions = this.allActions();
      if (actions.length > 0) {
        var contactId = actions.first().get('contactId');
        var contact = self.contacts.get(contactId);
        if (contact) {
          return contact.firstLast();
        } else {
          console.error('No contact found with id ', contactId);
          return '?!';
        }
      } else {
        return '-';
      }
    }
  });

  self.Events = OpenPunchCollection.extend({
    model: self.Event,
    url: self.apiRoot + 'events',
    defaults: function() {
      return {
        attendees: new self.Attendees()
      };
    },
    comparator: function(event) {
      return -new XDate(event.get('dtStart')).getTime();
    }
  });
  
  self.events = new self.Events();
  
  
  /*
   * Attendee
   */
  
  self.Attendee = OpenPunchModel.extend({
    urlRoot: self.apiRoot + 'attendees',
    initialize: function() {
      _.bindAll(this
        , 'updateStatus'
        , 'updateStatusSuccess'
        , 'chargeForEvent'
        , 'chargeForEventSuccess');
    },
    
    /*
     * Convenience methods
     */
    actions: function() {
      return new self.Actions(self.actions.where({
        eventId: this.get('eventId'),
        contactId: this.get('contactId')
      }));
    },
    latestAction: function() {
      return this.actions().first();
    },
    status: function() {
      return (this.latestAction()) ? this.latestAction().get('status') : null;
    },
    isCheckedIn: function() {
      return this.status() === 'in';
    },
    isCheckedOut: function() {
      return this.status() === 'out';
    },
    
    /*
     * Toggle check in status
     */
    updateStatus: function() {
      self.actions.create(_.extend(
        self.account.meta(), {
        eventId: this.get('eventId'),
        contactId: this.get('contactId'),
        status: this.isCheckedIn() ? 'out' : 'in'
      }), {
        wait: true,
        success: this.chargeForEvent,
        error: this.updateStatusError
      });
    },
    updateStatusSuccess: function() {
      console.log('attendee status saved');
    },
    updateStatusError: function(err, resp) {
      console.error(err);
      alert('Could not update status');
    },

    /*
    Create transaction
     */
    chargeForEvent: function(model, coll) {
      var trans = self.transactions.where({
        eventId: this.get('eventId'),
        contactId: this.get('contactId')
      });
      // Only charge once per event
      if (trans.length === 0)
        self.transactions.create(_.extend(
          self.account.meta(),
          {
            eventId: this.get('eventId'),
            contactId: this.get('contactId'),
            type: 'Event Fee',
            amount: self.events.get(this.get('eventId')).get('cost'),
            side: 'd'
          }
        ), {
          wait: true,
          success: this.chargeForEventSuccess,
          error: this.chargeForEventError
        });
    },
    chargeForEventSuccess: function(model, resp) {
      console.log('event fee transaction success');
    },
    chargeForEventError: function(err, resp) {
      console.error(err);
    }

  });
  
  self.Attendees = OpenPunchCollection.extend({
    model: self.Attendee,
    url: self.apiRoot + 'attendees',
    initialize: function(models, options) {
      _.each(models, function(model) {
        model.eventId = options.eventId;
      });
    }
  });
  
  
  /*
   * Attendee action
   */
  
  self.Action = Backbone.Model.extend();
  
  self.Actions = OpenPunchCollection.extend({
    model: self.Action,
    url: self.apiRoot + 'actions',
    comparator: function(model) {
      return -1 * new XDate(model.get('dt')).getTime();
    }
  });
  
  self.actions = new self.Actions();
  
  
  /*
   * User account
   */
  
  self.Account = OpenPunchModel.extend({
    urlRoot: self.apiRoot + 'account',
    meta: function() {
      return {
        accountId: this.id,
        sessionId: this.get('sessionId')
      };
    },
    loadData: function() {
      console.log('fetch all data');
      var options = {
        data: this.meta(),
        success: function(coll, resp) {
          console.log('coll fetch success');
        },
        error: function(coll, resp) {
          console.error(resp.responseText);
          self.router.navigate('account/sign-out', {trigger: true});
        }
      };
      self.events.fetch(options);
      self.contacts.fetch(options);
      self.actions.fetch(options);
      self.transactions.fetch(options);
    },
    setSessionId: function() {
      if (this.get('sessionId'))
        localStorage.setItem(self.hashes.sessionId, this.get('sessionId'));
    },
    getSessionId: function() {
      return localStorage.getItem(self.hashes.sessionId);
    },
    clearSessionId: function() {
      this.unset('sessionId', {silent: true});
      localStorage.removeItem(self.hashes.sessionId);
    }
  });
  
  self.account = new self.Account();
  
  /*
   * Sign In
   */
   
  self.SignInSchema = Backbone.Model.extend({
    schema: {
      email: {
        title: 'Email',
        validators: ['required', 'email'],
        fieldClass: 'signin-email',
        editorClass: 'span12'
      },
      password: {
        title: 'Password',
        type: 'Password',
        validators: ['required'],
        fieldClass: 'signin-password',
        editorClass: 'span12'
      }
    }
  });
   
  self.SignInView = BaseFormView.extend({
    el: '#sign-in',
    initialize: function() {
      BaseFormView.prototype.initialize.call(this);
      _.bindAll(this, 'signInSuccess', 'signInError');
      this.form = new Backbone.Form({
        model: new self.SignInSchema({
          email: 'jonarc124@gmail.com',
          password: 'drakejn3'
        }),
        idPrefix: 'signin-'
      });
    },
    render: function() {
      this.$el.find('.form-container').prepend(this.form.render().el);
      return this;
    },
    commitForm: function(e) {
      e.preventDefault();
      this.$el.find('.form-error').addClass('hide');
      var errors = this.form.commit();
      if (!errors) {
        self.account.fetch({
          data: this.form.model.toJSON(),
          success: this.signInSuccess,
          error: this.signInError
        });
      }
    },
    signInSuccess: function(account) {
      console.log('signInSuccess: ' + JSON.stringify(account.toJSON()));
      // Update local session ID
      account.setSessionId();
      // Redirect
      self.router.navigate('loading', {trigger: true});
    },
    signInError: function(account, resp) {
      console.log('signInError: ' + resp.responseText || account);
      this.$el.find('.form-error').text(resp.responseText).removeClass('hide');
    }
  });


  /*
   * Account
   */

  self.AccountView = Backbone.View.extend({
    el: '#account',
    template: _.template($('#account-view-template').html()),
    initialize: function() {
      this.model = self.account;
    },
    render: function() {
      this.$el.find('#content-account').html(this.template(this.model.toJSON()));
      return this;
    }
  });


  /*
   * Loading
   */

  self.LoadingView = Backbone.View.extend({
    el: '#loading',
    initialize: function() {
      this.numLoaded = 0;
      this.numToLoad = 4;
      self.events.on('reset', this.dataFetched, this);
      self.contacts.on('reset', this.dataFetched, this);
      self.actions.on('reset', this.dataFetched, this);
      self.transactions.on('reset', this.dataFetched, this);
    },
    dataReady: function() {
      return this.numLoaded === this.numToLoad;
    },
    dataFetched: function(coll) {
      console.log('collection loaded');
      // Collections is finished loaded, so incr the counter.
      this.numLoaded = this.numLoaded + 1;
      // If counter reaches target, go to the app
      if (this.dataReady()) {
        // Go to events
        self.router.navigate('events', {trigger: true});
      }
    }
  });


  /*
   * Events
   */

  self.EventsView = Backbone.View.extend({
    el: '#events',
    initialize: function() {
      _.bindAll(this, 'renderEvent');
      self.events.on('reset', this.renderEvents, this);
      self.events.on('all', function(name) { console.log('EventsView', name); }, this);
    },
    render: function() {
      this.list = this.$el.find('#events-list').empty();
      this.renderEvents(self.events);
      return this;
    },
    renderEvents: function(events, resp) {
      var eventGroups = events.groupBy(function(event) {
        return self.helpers.eventDate(event.get('dtStart'));
      });
      _.each(eventGroups, _.bind(function(events, key, list) {
        this.list.append('<li class="section-title"><h6>' + key + '</h6></li>');
        _.each(events, this.renderEvent);
      }, this));
      // Placeholder if no events
      this.$el.find('.list-placeholder').toggleClass('hide', events.length>0);
    },
    renderEvent: function(event) {
      var view = new self.EventLiView({model: event});
      this.list.append(view.render().el);
    },
    showDeleteAlert: function() {
      this.$el.find('.delete-alert').removeClass('hide');
      _.delay(_.bind(function() {
        this.$el.find('.delete-alert').addClass('hide');
      }, this), 3000);
    }
  });

  self.EventLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#event-li-view-template').html()),
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers)));
      return this;
    }
  });

  self.EventView = Backbone.View.extend({
    className: 'page event-page',
    attributes: function() {
      if (!this.model)
        self.router.navigate('loading', {trigger: true});
      return {
        id: 'event-' + this.model.id
      };
    },
    template: _.template($('#event-view-template').html()),
    events: {
      'click .init-scan': 'initScan'
    },
    initialize: function() {
      _.bindAll(this
        , 'initScan'
        , 'scanSuccess'
        , 'scanError'
      );
      self.actions.on('add', this.refresh, this);
    },
    helpers: function() {
      return {
        totalAttendees: this.model.totalAttendees(),
        lastAttendeeName: this.model.lastAttendeeName(),
        status: this.model.status()
      };
    },
    refresh: function(action) {
      if (action.get('eventId')===this.model.id)
        this.render();
    },
    render: function() {
      this.$el.html(this.template(_.extend(
        this.model.toJSON(),
        self.helpers,
        this.helpers()
      )));
      return this;
    },

    /*
     * Scanning
     */
    initScan: function(event) {
      if (window.plugins.barcodeScanner) {
        window.plugins.barcodeScanner.scan(this.scanSuccess, this.scanError);
      } else {
        alert('Scanning from browser not supported');
//        var contact = self.contacts.at(0);
//        this.scanSuccess({text: contact.id});
      }
    },
    scanSuccess: function(result) {
      if (result.cancelled) {
        return false;
      } else {
        this.toggleStatus(result.text);
        return true;
      }
    },
    scanError: function(error) {
      alert("scanning failed: " + error);
    },

    /*
     * Attendee status
     */
    toggleStatus: function(contactId) {
      var attendees = this.model.get('attendees').where({contactId: contactId});
      if (attendees.length > 0) {
        var attendee = attendees[0];
        attendee.updateStatus();
      } else {
        // Does contact exist?
        var contact = self.contacts.get(contactId);
        if (contact) {
          this.model.get('attendees').create(_.extend(self.account.meta(), {contactId: contactId}), {
            wait: true,
            success: function(model, resp) {
              model.updateStatus();
            },
            error: function(model, resp) {
              console.error(resp);
              alert('Could not toggle status');
            }
          });
        } else {
          alert('Contact with that ID does not exist');
        }
      }
    }

  }); // EventView

  self.EventSchema = Backbone.Model.extend({
    schema: {
      name: {
        title: 'Name',
        validators: ['required'],
        fieldClass: 'event-name',
        editorAttrs: {
          placeholder: 'e.g. Volunteer Club'
        },
        editorClass: 'span12'
      },
      dtStart: {
        title: 'Start Date &amp; Time',
        dataType: 'datetime',
        validators: ['required'],
        fieldClass: 'event-startdatetime',
        editorClass: 'span12'
      },
      dtEnd: {
        title: 'End Date &amp; Time',
        dataType: 'datetime',
        validators: ['required'],
        fieldClass: 'event-enddatetime',
        editorClass: 'span12'
      },
      cost: {
        title: 'Cost',
        validators: ['required'],
        fieldClass: 'event-cost',
        editorClass: 'span3 currency',
        template: 'currency'
      },
      location: {
        title: 'Location',
        fieldClass: 'event-location',
        editorAttrs: {
          placeholder: 'e.g. Chicago Ave.'
        },
        help: '(optional)',
        editorClass: 'span12'
      },
      facilitator: {
        title: 'Facilitator',
        fieldClass: 'event-facilitator',
        editorAttrs: {
          placeholder: 'e.g. Tara Wickey'
        },
        help: '(optional)',
        editorClass: 'span12'
      }
    }
  });

  self.EventSchemaDetail = Backbone.Model.extend({
    schema: {
      name: {
        title: 'Name',
        validators: ['required'],
        fieldClass: 'event-name',
        editorAttrs: {
          placeholder: 'e.g. Volunteer Club'
        },
        editorClass: 'span12'
      },
      dtStart: {
        title: 'Start Date',
        type: 'DateTime',
        validators: ['required'],
        fieldClass: 'event-startdatetime',
        editorClass: 'span12'
      },
      dtEnd: {
        title: 'End Date',
        type: 'DateTime',
        validators: ['required'],
        fieldClass: 'event-enddatetime',
        editorClass: 'span12'
      },
      cost: {
        title: 'Cost',
        validators: ['required'],
        fieldClass: 'event-cost',
        template: 'currency',
        editorClass: 'span3 currency'
      },
      location: {
        title: 'Location',
        fieldClass: 'event-location',
        editorAttrs: {
          placeholder: 'e.g. Chicago Ave.'
        },
        help: '(optional)',
        editorClass: 'span12'
      },
      facilitator: {
        title: 'Facilitator',
        fieldClass: 'event-facilitator',
        editorAttrs: {
          placeholder: 'e.g. Tara Wickey'
        },
        help: '(optional)',
        editorClass: 'span12'
      }
    }
  });

  self.FormSubmitModalView = Backbone.View.extend({
    attributes: function() {
      return {
        id: this.options.idPrefix + 'modal-' + this.model.id,
        'class': this.options.idPrefix + 'modal modal'
      };
    },
    template: function() {
      return _.template($('#' + this.options.idPrefix + 'modal-template').html());
    },
    events: {
      'click .dismiss': 'dismiss'
    },
    initialize: function() {
      _.bindAll(this, 'dismiss');
      this.model.on('show:modal', this.render, this);
    },
    render: function() {
      this.$el.html(this.template()({_id: this.model.id}));
      this.$el.modal();
      // Set position
      var modalTop = $(window).scrollTop() + $(window).height() - this.$el.height() - 20;
      this.$el.offset({top: modalTop});
      return this;
    },
    dismiss: function(e) {
      this.$el.modal('hide');
    }
  });

  self.EventEditView = BaseFormView.extend({
    initialize: function() {
      BaseFormView.prototype.initialize.call(this);
      if (self.os==='ios') {
        this.form = new Backbone.Form({
          model: new self.EventSchema({
            _id: this.model.id,
            accountId: self.account.id,
            name: this.model.get('name'),
            dtStart: self.helpers.datePickerFormats[self.os].datetime(this.model.get('dtStart')),
            dtEnd: self.helpers.datePickerFormats[self.os].datetime(this.model.get('dtEnd')),
            cost: this.model.get('cost'),
            location: this.model.get('location'),
            facilitator: this.model.get('facilitator')
          }),
          idPrefix: 'event-'
        });
      } else {
        this.form = new Backbone.Form({
          model: new self.EventSchemaDetail({
            _id: this.model.id,
            accountId: self.account.id,
            name: this.model.get('name'),
            dtStart: new XDate(this.model.get('dtStart')).toDate(),
            dtEnd: new XDate(this.model.get('dtEnd')).toDate(),
            cost: this.model.get('cost'),
            location: this.model.get('location'),
            facilitator: this.model.get('facilitator')
          }),
          idPrefix: 'event-'
        });
      }
      this.modal = new self.FormSubmitModalView({model: this.model, idPrefix: this.options.idPrefix});
    }
  });

  self.EventCreateView = BaseFormView.extend({
    initialize: function() {
      _.bindAll(this, 'eventCreateSuccess');
      this.model = new self.Event();
      this.form = new Backbone.Form({
        model: (self.os==='ios') ? new self.EventSchema(this.model.toJSON()) : new self.EventSchemaDetail(this.model.toJSON()),
        idPrefix: 'event-'
      });
    },
    commitForm: function(e) {
      e.preventDefault();
      var errors = this.form.commit();
      if (!errors) {
        self.events.create(_.extend(self.account.meta(), this.form.model.toJSON()), {
          success: this.eventCreateSuccess,
          error: this.eventCreateError
        });
      }
    },
    eventCreateSuccess: function(model) {
      // Reset model
      this.form.model.clear();
      // Go to new event's dashboard
      self.router.navigate('events/' + model.id, {trigger: true});
    },
    eventCreateError: function() {
      console.log(arguments);
    }
  });

  self.EventContactsView = Backbone.View.extend({
    className: 'page event-contacts-page hide',
    attributes: function() {
      if (!this.model)
        self.router.navigate('loading', {trigger: true});
      return {
        id: 'event-contacts-' + this.model.id
      };
    },
    template: _.template($('#event-contacts-view-template').html()),
    initialize: function() {
      _.bindAll(this, 'renderEventContact');
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers)));
      this.list = this.$el.find('.contact-list');
      self.contacts.each(this.renderEventContact);
      return this;
    },
    renderEventContact: function(contact) {
      var attendees = this.model.get('attendees').where({contactId: contact.id})
        , attendee = (attendees.length>0) ? attendees[0] : new self.Attendee({
            contactId: contact.id,
            eventId: this.model.id
          });
      var view = new self.EventContactLiView({
        model: contact,
        event: this.model,
        attendee: attendee
      });
      this.list.append(view.render().el);
    }
  });

  self.EventContactLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#event-contact-view-template').html()),
    events: {
      'click': 'toggleStatus'
    },
    initialize: function() {
      _.bindAll(this
        , 'statusIconClass'
        , 'lastSeenDate'
        , 'lastSeenLabelClass'
        , 'toggleStatus'
      );
      this.event = this.options.event;
      this.attendee = this.options.attendee;
      this.attendee.on('change', this.render, this);
      self.actions.on('add', this.render, this);
    },

    /*
     * Rendering
     */
    statusIconClass: function() {
      if (this.attendee.isCheckedIn())
        return 'icon-ok';
      else if (this.attendee.isCheckedOut())
        return 'icon-arrow-left';
      else
        return 'icon-blank';
    },
    lastSeenDate: function() {
     if (this.attendee.latestAction()) {
        return self.helpers.relativeTime(this.attendee.latestAction().get('dt'));
      } else {
        return null;
      }
    },
    lastSeenLabelClass: function() {
      return this.attendee.isCheckedIn() ? 'label-success' : '';
    },
    helpers: function() {
      return {
        statusIconClass: this.statusIconClass,
        lastSeenDate: this.lastSeenDate,
        lastSeenLabelClass: this.lastSeenLabelClass
      };
    },
    render: function(action) {
      if (action)
        if (!(action.get('eventId')===this.event.id && action.get('contactId')===this.model.id))
          return;
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers, this.helpers(), {
        attendee: this.attendee.toJSON()
      })));
      return this;
    },

    /*
     * Status
     */
    toggleStatus: function(e) {
      e.preventDefault();
      if (this.attendee.actions().length > 0)
        this.attendee.updateStatus();
      else
        this.event.get('attendees').create(_.extend(self.account.meta(), this.attendee.toJSON()), {
          wait: true,
          success: function(model, resp) {
            model.updateStatus();
          },
          error: function() {
            console.error(arguments);
            alert('Could not toggle status');
          }
        });
    }

  });

  self.EventHistoryView = Backbone.View.extend({
    className: 'page event-history-page hide',
    attributes: function() {
      if (!this.model)
        self.router.navigate('loading', {trigger: true});
      return {
        id: 'event-history-' + this.model.id
      };
    },
    template: _.template($('#event-history-view-template').html()),
    initialize: function() {
      _.bindAll(this, 'renderEventAction');
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers)));
      this.list = this.$el.find('.action-list');
      this.model.allActions().each(this.renderEventAction);
      // Placeholder if no events
      this.$el.find('.list-placeholder').toggleClass('hide', this.model.allActions().length>0);
      return this;
    },
    renderEventAction: function(action) {
      var view = new self.EventActionLiView({model: action});
      this.list.append(view.render().el);
    }
  });

  self.EventActionLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#event-action-view-template').html()),
    initialize: function() {
      _.bindAll(this
        , 'timestamp'
        , 'timestampLabelClass'
      );
      this.model.set({contact: self.contacts.get(this.model.get('contactId')).toJSON()});
    },

    /*
     * Rendering
     */
    timestamp: function() {
      return self.helpers.relativeTime(this.model.get('dt'));
    },
    timestampLabelClass: function() {
      return this.model.get('status')==='in' ? 'label-success' : 'label-important';
    },
    helpers: function() {
      return {
        timestamp: this.timestamp,
        timestampLabelClass: this.timestampLabelClass
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers, this.helpers())));
      return this;
    }

  });


  /*
   * Contacts
   */

  self.ContactsView = Backbone.View.extend({
    el: '#contacts',
    events: {
      'click #filter-contacts': 'toggleFilterDialog',
      'click .filter-button-close': 'closeFilters'
    },
    initialize: function() {
      _.bindAll(this, 'renderContact');
      self.contacts.on('reset', this.renderContacts, this);
      this.rolesFilter = new self.FilterGroupRoles();
      this.rolesFilter.get('filters').on('change:active', this.toggleFilterNotification, this);
    },
    render: function() {
      this.list = this.$el.find('.contact-list').empty();
      this.filterContainer = this.$el.find('.filter-container').empty();
      this.rolesFilter.get('filters').each(this.renderFilter, this);
      this.toggleFilterNotification();
      this.renderContacts(self.contacts);
      return this;
    },
    renderContacts: function(contacts, resp) {
      // Placeholder if no contacts
      this.$el.find('.list-placeholder').toggleClass('hide', contacts.length>0);
      // Render each
      contacts.each(this.renderContact);
    },
    renderContact: function(contact) {
      var view = new self.ContactLiView({
        model: contact,
        parent: this
      });
      this.list.append(view.render().el);
    },
    renderFilter: function(filter) {
      var view = new self.FilterToggleView({
        model: filter,
        parent: this
      });
      this.filterContainer.append(view.render().el);
    },
    showDeleteAlert: function() {
      this.$el.find('.delete-alert').removeClass('hide');
      _.delay(_.bind(function() {
        this.$el.find('.delete-alert').addClass('hide');
      }, this), 3000);
    },
    toggleFilterDialog: function(e) {
      e.preventDefault();
      $(e.currentTarget).parent().toggleClass('open');
    },
    closeFilters: function(e) {
      $(e.currentTarget).parents('.open').removeClass('open');
    },
    toggleFilterNotification: function() {
      this.$el.find('#filter-contacts').toggleClass('btn-warning', this.rolesFilter.isActive());
    }
  });

  self.ContactLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#contact-li-view-template').html()),
    initialize: function() {
      this.options.parent.rolesFilter.get('filters').on('change:active', this.updateFilter, this);
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers)));
      this.updateFilter();
      return this;
    },
    updateFilter: function() {
      this.$el.toggleClass('hide', !this.options.parent.rolesFilter.pass(this.model));
    }
  });

  self.ContactView = Backbone.View.extend({
    className: 'page contact-page',
    template: _.template($('#contact-view-template').html()),
    attributes: function() {
      return {
        id: 'contact-' + this.model.id
      };
    },
    helpers: function() {
      return {
        firstLast: _.bind(this.model.firstLast, this.model),
        firstLastInitial: _.bind(this.model.firstLastInitial, this.model),
        totalCheckIns: _.bind(this.model.totalCheckIns, this.model),
        totalTime: _.bind(this.model.totalTime, this.model),
        balance: _.bind(this.model.balance, this.model),
        balanceClass: _.bind(this.model.balanceClass, this.model)
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(
        this.model.toJSON(),
        self.helpers,
        this.helpers())
      ));
      return this;
    }
  });

  self.ContactSchema = Backbone.Model.extend({
    schema: {
      first: {
        title: 'First name',
        validators: ['required'],
        fieldClass: 'contact-first',
        editorAttrs: {
          placeholder: 'e.g. Jane'
        },
        editorClass: 'span12'
      },
      last: {
        title: 'Last name',
        validators: ['required'],
        fieldClass: 'contact-last',
        editorAttrs: {
          placeholder: 'e.g. Smith'
        },
        editorClass: 'span12'
      },
      role: {
        title: 'Role',
        type: 'Select',
        options: _.pluck(self.roles, 'value'),
        validators: ['required'],
        fieldClass: 'contact-role',
        editorClass: 'span12'
      }
    }
  });

  self.EditContactView = BaseFormView.extend({
    initialize: function() {
      BaseFormView.prototype.initialize.call(this);
      this.form = new Backbone.Form({
        model: new self.ContactSchema(this.model.toJSON()),
        idPrefix: 'contact-'
      });
      this.modal = new self.FormSubmitModalView({model: this.model, idPrefix: this.options.idPrefix});
    }
  });

  self.ContactCreateView = BaseFormView.extend({
    initialize: function() {
      _.bindAll(this, 'contactCreateSuccess');
      this.model = new self.Contact();
      this.form = new Backbone.Form({
        model: new self.ContactSchema(),
        idPrefix: 'contact-'
      });
    },
    commitForm: function(e) {
      e.preventDefault();
      var errors = this.form.commit();
      if (!errors) {
        self.contacts.create(_.extend(self.account.meta(), this.form.model.toJSON()), {
          success: this.contactCreateSuccess,
          error: this.contactCreateError
        });
      }
    },
    contactCreateSuccess: function(model) {
      self.router.navigate('contacts/' + model.id, {trigger: true});
    },
    contactCreateError: function() {
      console.log(arguments);
    }
  });

  var isNumber = function(field, value, formValues) {
    var err = {
      type: field,
      message: 'must be a number'
    };
    if (_.isNaN(parseFloat(value)))
      return err;
  };

  var gt0 = function(field, value, formValues) {
    var err = {
      type: field,
      message: 'must be more than $0'
    };
    if (parseFloat(value) <= 0)
      return err;
  };

  self.TransactionSchema = Backbone.Model.extend({
    schema: {
      type: {
        title: 'Transaction Type',
        type: 'Select',
        options: ['Subscription Refill', 'Adhoc Charge'],
        validators: ['required'],
        fieldClass: 'transaction-type',
        editorClass: 'span12'
      },
      amount: {
        title: 'Amount',
        validators: [
          'required',
          _.bind(isNumber, this, 'amount'),
          _.bind(gt0, this, 'amount')
        ],
        fieldClass: 'transaction-amount',
        editorClass: 'span3 currency',
        template: 'currency'
      },
      notes: {
        title: 'Notes',
        type: 'TextArea',
        help: '(optional)',
        fieldClass: 'transaction-notes',
        editorClass: 'span12'
      }
    }
  });

  self.TransactionCreateView = BaseFormView.extend({
    initialize: function() {
      _.bindAll(this, 'transactionCreateSuccess', 'transactionCreateError', 'changeSide');
      this.model = new self.Transaction({contactId: this.options.contactId});
      this.form = new Backbone.Form({
        model: new self.TransactionSchema({
          amount: 0
        }),
        idPrefix: 'transaction-'
      });
      this.form.on('type:change', this.changeSide);
    },
    changeSide: function(form, titleEditor) {
      // Update ledger side
      this.model.set({side: (titleEditor.getValue()==='Adhoc Charge') ? 'd' : 'c'}, {silent: true});
    },
    commitForm: function(e) {
      e.preventDefault();
      var errors = this.form.commit();
      if (!errors) {
        self.transactions.create(
          _.extend(
            self.account.meta(),
            this.options,
            this.model.toJSON(),
            this.form.model.toJSON()
          ),
          {
            wait: true,
            success: this.transactionCreateSuccess,
            error: this.transactionCreateError
          }
        );
      }
    },
    transactionCreateSuccess: function(model) {
      // Reset model
      this.form.model.clear();
      // Go to new contact transactions list
      self.router.navigate('contacts/' + model.get('contactId') + '/transactions', {trigger: true});
      // Show alert
      self.router.renderedViews.ContactTransactionsView[model.get('contactId')].showAddAlert();
    },
    transactionCreateError: function(model, resp) {
      console.log(resp.responseText);
      self.transactions.remove(self.transactions.getByCid(model.cid));
    }
  });

  self.ContactTransactionsView = Backbone.View.extend({
    className: 'page contact-transactions-page hide',
    attributes: function() {
      if (!this.model)
        self.router.navigate('loading', {trigger: true});
      return {
        id: 'contact-transactions-' + this.model.id
      };
    },
    template: _.template($('#contact-transactions-view-template').html()),
    initialize: function() {
      _.bindAll(this, 'renderContactTransaction');
    },
    helpers: function() {
      return {
        firstLastInitial: _.bind(this.model.firstLastInitial, this.model)
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(
        this.model.toJSON(),
        self.helpers,
        this.helpers())
      ));
      this.list = this.$el.find('.transaction-list');
      this.model.transactions().each(this.renderContactTransaction);
      // Placeholder if no transactions
      this.$el.find('.list-placeholder').toggleClass('hide', this.model.transactions().length>0);
      return this;
    },
    renderContactTransaction: function(action) {
      var view = new self.ContactTransactionTrView({model: action});
      this.list.append(view.render().el);
    },
    showAddAlert: function() {
      this.$el.find('.add-alert').removeClass('hide');
      _.delay(_.bind(function() {
        this.$el.find('.add-alert').addClass('hide');
      }, this), 3000);
    }
  });

  self.ContactTransactionTrView = Backbone.View.extend({
    tagName: 'tr',
    template: _.template($('#contact-transaction-tr-view-template').html()),
    initialize: function() {
    },

    /*
     * Rendering
     */
    helpers: function() {
      return {
        ledgerAmount: _.bind(this.model.ledgerAmount, this.model),
        amountClass: _.bind(this.model.amountClass, this.model),
        newBalance: _.bind(this.model.newBalance, this.model)
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(
        this.model.toJSON(),
        self.helpers,
        this.helpers())
      ));
      return this;
    }
  });

  self.ContactHistoryView = Backbone.View.extend({
    className: 'page contact-history-page hide',
    attributes: function() {
      if (!this.model)
        self.router.navigate('loading', {trigger: true});
      return {
        id: 'contact-history-' + this.model.id
      };
    },
    template: _.template($('#contact-history-view-template').html()),
    initialize: function() {
      _.bindAll(this, 'renderContactAction');
    },
    helpers: function() {
      return {
        firstLastInitial: _.bind(this.model.firstLastInitial, this.model)
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers, this.helpers())));
      this.list = this.$el.find('.action-list');
      this.model.actions().each(this.renderContactAction);
      // Placeholder if no actions
      this.$el.find('.list-placeholder').toggleClass('hide', this.model.actions().length>0);
      return this;
    },
    renderContactAction: function(action) {
      var view = new self.ContactActionLiView({model: action});
      this.list.append(view.render().el);
    }
  });

  self.ContactActionLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#contact-action-view-template').html()),
    initialize: function() {
      _.bindAll(this, 'timestamp');
      var event = self.events.get(this.model.get('eventId'));
      if (event)
        this.model.set({event: event.toJSON()});
      else
        this.template = true;
    },

    /*
     * Rendering
     */
    timestamp: function() {
      return self.helpers.relativeTime(this.model.get('dt'));
    },
    statusVerb: function() {
      return (this.status==='in') ? 'into' : 'out of';
    },
    helpers: function() {
      return {
        timestamp: this.timestamp,
        statusVerb: this.statusVerb
      };
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers, this.helpers())));
      return this;
    }

  });


  /*
   * Errors
   */

  self.Error404 = Backbone.View.extend({
    el: '#error-404'
  });


  /*
   * Application controller
   */

  self.Workspace = Backbone.Router.extend({
    initialize: function() {
    },

    /*
     * Render group of pages once
     */
    renderedViews: {
      SignInView: {},
      AccountView: {},
      LoadingView: {},
      EventsView: {},
      EventCreateView: {},
      EventView: {},
      EventEditView: {},
      EventHistoryView: {},
      EventContactsView: {},
      ContactsView: {},
      ContactCreateView: {},
      ContactView: {},
      EditContactView: {},
      TransactionCreateView: {},
      ContactTransactionsView: {},
      ContactHistoryView: {},
      Error404: {}
    },
    renderViews: function(id, toRender, options) {
      options = options || {};
      _.each(toRender, _.bind(function(constr) {
        // Render event
        var view = new self[constr](options);
        // Append to body
        $('body').append(view.render().el);
        // Save view for later
        this.renderedViews[constr][id] = view;
      }, this));
    },
    loadExistingPage: function(id, viewClass) {
      $('.page').addClass('hide');
      $('.leave-open').removeClass('open');
      this.renderedViews[viewClass][id].render().$el.removeClass('hide');
    },


    /*
     * Routing
     */
    routes: {
      ''                      : 'signIn',
      'loading'               : 'loading',
      'account'               : 'account',
      'account/sign-in'       : 'signIn',
      'account/sign-out'      : 'signOut',
      'events'                : 'events',
      'events/new'            : 'eventNew',
      'events/:id'            : 'eventDashboard',
      'events/:id/dashboard'  : 'eventDashboard',
      'events/:id/edit'       : 'eventEdit',
      'events/:id/delete'     : 'eventDelete',
      'events/:id/history'    : 'eventHistory',
      'events/:id/contacts'   : 'eventContacts',
      'contacts'              : 'contacts',
      'contacts/new'          : 'contactNew',
      'contacts/:id'          : 'contactDetails',
      'contacts/:id/details'  : 'contactDetails',
      'contacts/:id/edit'     : 'contactEdit',
      'contacts/:id/delete'   : 'contactDelete',
      'contacts/:id/transactions': 'contactTransactions',
      'contacts/:id/transactions/new': 'transactionNew',
      'contacts/:id/history'  : 'contactHistory',
      '404'                   : 'error404'
    },

    /*
     * Account
     */
    signIn: function() {
      console.log('account has sessionId?', self.account.has('sessionId'));
      if (self.account.has('sessionId')) {
        // Account signed in, move along...
        console.log('account already fetched');
        self.router.navigate('loading', {trigger: true});
      } else {
        // See if locally stored session ID is still valid
        var localSessionId = self.account.getSessionId();
        if (localSessionId) {
          // Session cookie set, need to retrieve account then move along...
          console.log('Fetch account using local session id');
          self.account.fetch({
            data: {sessionId: localSessionId},
            success: function(model, resp) {
              // Set session ID
              self.account.setSessionId();
              // Load data
              self.router.navigate('loading', {trigger: true});
            },
            error: function(model, resp) {
              // Remove stale session ID
              self.account.clearSessionId();
              console.log(resp.responseText);
              // Try sign in page again
              self.router.navigate('account/sign-in', {trigger: true});
            }
          });
        } else {
          // Make user sign in
          console.log('No local session ID. Sign in');
          var id = 0;
          $('.page').addClass('hide');
          if (_.has(this.renderedViews.SignInView, id)) {
            this.renderedViews.SignInView[id].$el.removeClass('hide');
          } else {
            this.renderViews(id, ['SignInView']);
            this.renderedViews.SignInView[id].$el.removeClass('hide');
          }
        }
      }
    },

    signOut: function() {
      // Clear account model
      self.account.clear({silent: true});
      self.events.reset([], {silent: true});
      self.contacts.reset([], {silent: true});
      self.actions.reset([], {silent: true});
      self.transactions.reset([], {silent: true});
      // Reset load count
      this.renderedViews.LoadingView[0].numLoaded = 0;
      console.log('account cleared');
      // Go to sign in
      self.router.navigate('account/sign-in', {trigger: true});
    },

    account: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.AccountView, id)) {
        this.loadExistingPage(id, 'AccountView');
      } else {
        this.renderViews(id, ['AccountView']);
        this.renderedViews.AccountView[id].$el.removeClass('hide');
      }
    },
    
    /*
     * Loading
     */
    loading: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.LoadingView, id)) {
        // View exists, so check if data needs to be reloaded
        var view = this.renderedViews.LoadingView[id];
        if (view.dataReady()) {
          // Ready to go
          self.router.navigate('events', {trigger: true});
        } else {
          // Show page, reload data
          view.$el.removeClass('hide');
          self.account.loadData();
        }
      } else {
        // Need to render view and load data
        this.renderViews(id, ['LoadingView']);
        this.renderedViews.LoadingView[id].$el.removeClass('hide');
        self.account.loadData();
      }
    },
    
    /*
     * Events
     */
    events: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.EventsView, id)) {
        this.loadExistingPage(id, 'EventsView');
      } else {
        this.renderViews(id, ['EventsView']);
        this.renderedViews.EventsView[id].$el.removeClass('hide');
      }
    },
    eventNew: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.EventCreateView, id)) {
        this.loadExistingPage(id, 'EventCreateView');
      } else {
        this.renderViews(id, ['EventCreateView'], {idPrefix: 'event-create-'});
        this.renderedViews.EventCreateView[id].$el.removeClass('hide');
      }
    },
    eventDashboard: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.EventView, id)) {
        this.loadExistingPage(id, 'EventView');
      } else {
        var event = self.events.get(id);
        if (!event) {
          self.router.navigate('404', {trigger: true});
        } else {
          this.renderViews(id, ['EventView', 'EventHistoryView', 'EventContactsView'], {model: event});
          this.renderViews(id, ['EventEditView'], {model: event, idPrefix: 'event-edit-'});
        }
      }
    },
    eventEdit: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'EventEditView');
    },
    eventDelete: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var event = self.events.get(id);
      if (confirm('Delete "' + event.get('name') + '"? This will also remove the event from each attendee\'s history.')) {
        event.destroy({
          headers: self.account.meta(),
          success: _.bind(function() {
            this.renderedViews.EventsView[0].showDeleteAlert();
            self.router.navigate('events', {trigger: true});
          }, this),
          error: function(model, resp) {
            console.error('Could not delete event:', event.get('name'), resp);
            alert('Oops! Could not delete event.');
          }
        });
      }
    },
    eventHistory: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'EventHistoryView');
    },
    eventContacts: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'EventContactsView');
    },
    
    /*
     * Contacts
     */
    contacts: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.ContactsView, id)) {
        this.loadExistingPage(id, 'ContactsView');
      } else {
        this.renderViews(id, ['ContactsView']);
        this.renderedViews.ContactsView[id].$el.removeClass('hide');
      }
    },
    contactNew: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.ContactCreateView, id)) {
        this.loadExistingPage(id, 'ContactCreateView');
      } else {
        this.renderViews(id, ['ContactCreateView'], {idPrefix: 'contact-create-'});
        this.renderedViews.ContactCreateView[id].$el.removeClass('hide');
      }
    },
    contactDetails: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      console.log(id);
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.ContactView, id)) {
        this.loadExistingPage(id, 'ContactView');
      } else {
        var model = self.contacts.get(id);
        if (!model) {
          self.router.navigate('404', {trigger: true});
        } else {
          this.renderViews(id, ['ContactView', 'ContactTransactionsView', 'ContactHistoryView'], {model: model, idPrefix: 'contact-'});
          this.renderViews(id, ['EditContactView'], {model: model, idPrefix: 'contact-edit-'});
          this.renderViews(id, ['TransactionCreateView'], {contactId: id, idPrefix: 'transaction-create-'});
        }
      }
    },
    contactEdit: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'EditContactView');
    },
    contactDelete: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var contact = self.contacts.get(id);
      if (confirm('Delete "' + contact.firstLast() + '"? This will also remove contact from each event\'s history.')) {
        contact.destroy({
          headers: self.account.meta(),
          success: _.bind(function() {
            this.renderedViews.ContactsView[0].showDeleteAlert();
            self.router.navigate('contacts', {trigger: true});
          }, this),
          error: function(model, resp) {
            console.error('Could not delete contact:', contact.firstLast(), resp);
            alert('Oops! Could not delete contact.');
          }
        });
      }
    },
    transactionNew: function(contactId) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = contactId
        , viewName = 'TransactionCreateView'
        , idPrefix = 'transaction';
      $('.page').addClass('hide');
      if (_.has(this.renderedViews[viewName], id)) {
        this.loadExistingPage(id, viewName);
      } else {
        this.renderViews(id, [viewName], {
          idPrefix: idPrefix+'-create-',
          contactId: contactId
        });
        this.renderedViews[viewName][id].$el.removeClass('hide');
      }
    },
    contactTransactions: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'ContactTransactionsView');
    },
    contactHistory: function(id) {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      this.loadExistingPage(id, 'ContactHistoryView');
    },

    /*
    Errors
     */
    error404: function() {
      if (!self.account.has('sessionId') || !self.account.id) {
        self.router.navigate('account/sign-in', {trigger: true});
        return false;
      }
      var id = 0;
      $('.page').addClass('hide');
      if (_.has(this.renderedViews.Error404, id)) {
        this.loadExistingPage(id, 'Error404');
      } else {
        this.renderViews(id, ['Error404']);
        this.renderedViews.Error404[id].$el.removeClass('hide');
      }
    }

  });
  
  self.router = new self.Workspace();
  Backbone.history.start();
  
  return self;
  
}