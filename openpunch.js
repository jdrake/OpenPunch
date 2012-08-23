
function _OpenPunch(env, os) {
  
  // Global var to be filled with models, data, etc. 
  var self = {
    env: env,
    os: os
  };
  
//  self.apiRoot = 'http://littledrakedev.com/api/';
  self.apiRoot = 'http://127.0.0.1:3030/api/';
//  self.apiRoot = 'http://192.168.0.101:3030/api/';

  // Hook into jquery
  // Use withCredentials to send the server cookies
  // The server must allow this through response headers
  $.ajaxPrefilter( function( options, originalOptions, jqXHR ) {
    options.xhrFields = {
      withCredentials: true
    };
  });
  
  /*
   * Cookie names
   */
  self.cookies = {
    session: 'connect.sid'
  };
  
  /*
   * Base models and collections, depending on data source
   */
  
  var MongoModel = Backbone.Model.extend({
    idAttribute: '_id'
  });
  
  var SFModel = Backbone.Model.extend({
    idAttribute: 'Id'
  });
  
  var OpenPunchModel = MongoModel;
  
  var MongoCollection = Backbone.Collection;
  
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
        class: this.options.idPrefix + 'page page hide'
      };
    },
    template: function() { 
      return _.template($('#' + this.options.idPrefix + 'template').html()); 
    },
    events: {
      'click button[type=submit]': 'commitForm'
    },
    render: function() {
      this.$el.html(this.template()(_.extend(this.model.toJSON(), self.helpers)));
      this.$el.find('.form-container').prepend(this.form.render().el);
      return this;
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
    eventDate: function(d) {
      var date = new XDate(d)
        , diff = date.diffDays(new XDate());
      if (diff > -1 && diff < 1)
        return 'Today';
      else if (diff >= 1 && diff < 2)
        return 'Yesterday';
      else
        return date.toString('ddd MMM d, yyyy');
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
     return _.string.sprintf('$%.2f', parseFloat(v));
    },
    simpleDate: function(dt) {
      return new XDate(dt).toString('MMM d');
    }
  };


  /*
  Transaction
   */
  self.Transaction = OpenPunchModel.extend({
    defaults: function() {
      return {
        dtAdd: new Date(),
        dtMod: new Date(),
        amountCash: 0.0,
        amountCheck: 0.0,
        type: 'Subscription Refill'
      };
    },
    amountTotal: function() {
      return this.get('amountCash')+this.get('amountCheck');
    }
  });

  self.Transactions = OpenPunchCollection.extend({
    model: self.Transaction,
    url: self.apiRoot + 'transactions',
    comparator: function(model) {
      return -model.get('dtAdd');
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
    actions: function() {
      return new self.Actions(self.actions.where({contactId: this.id}));
    },
    transactions: function() {
      return new self.Transactions(self.transactions.where({contactId: this.id}));
    },
    balance: function() {
      return this.transactions().reduce(function(memo, t) {
        return memo + t.amountTotal();
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
        if (group.length != 2)
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
    parse: function(model) {
      model.attendees = new self.Attendees(model.attendees || [], {eventId: model._id});
      return model;
    },
    allActions: function() {
      return new self.Actions(self.actions.filter(_.bind(function(action) {
        // This event, and contact still exists
        return action.get('eventId') == this.id && self.contacts.get(action.get('contactId'));
      }, this)));
    }
  });

  self.Events = OpenPunchCollection.extend({
    model: self.Event,
    url: self.apiRoot + 'events',
    defaults: function() {
      return {
        attendees: new self.Attendees()
      }
    },
    comparator: function(event) {
      return event.get('dtStart');
    }
  });
  
  self.events = new self.Events();
  
  
  /*
   * Attendee
   */ 
  
  self.Attendee = OpenPunchModel.extend({
    urlRoot: self.apiRoot + 'attendees', 
    
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
      return (this.latestAction())
        ? this.latestAction().get('status')
        : null;
    },
    isCheckedIn: function() {
      return this.status() == 'in';
    },
    isCheckedOut: function() {
      return this.status() == 'out';
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
        success: this.updateStatusSuccess,
        error: this.updateStatusError
      });
    },
    updateStatusSuccess: function() {
      console.log('attendee status saved');
    },
    updateStatusError: function(err, resp) {
      console.error(err);
      alert('Could not update status');
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
    setUrlRoot: function(urlPiece) {
      this.urlRoot = self.apiRoot + urlPiece;
    },
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
    signInSuccess: function(model) {
      console.log('signInSuccess: ' + JSON.stringify(model.toJSON()));
      // Redirect
      self.router.navigate('loading', {trigger: true});
    },
    signInError: function(model, resp) {
      console.log('signInError: ' + resp.responseText || model);
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
      return this.numLoaded == this.numToLoad;
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
        , 'totalAttendees'
        , 'lastAttendeeName'
        , 'initScan'
        , 'scanSuccess'
        , 'scanError'
      );
      self.actions.on('add', this.refresh, this);
    },
    totalAttendees: function() {
      var checkIns = this.model.allActions().where({status: 'in'})
        , contactIds = _.map(checkIns, function(action){ return action.get('contactId'); })
        , uniqIds = _.uniq(contactIds)
      return uniqIds.length;
    },
    lastAttendeeName: function() {
      var actions = this.model.allActions();
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
    },
    helpers: function() {
      return {
        totalAttendees: this.totalAttendees,
        lastAttendeeName: this.lastAttendeeName
      };
    },
    refresh: function(action) {
      if (action.get('eventId')==this.model.id)
        this.render();
    },
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers, this.helpers())));
      return this;
    },

    /*
     * Scanning
     */
    initScan: function(event) {
      if (window.plugins.barcodeScanner) {
        window.plugins.barcodeScanner.scan(this.scanSuccess, this.scanError);
      } else {
//        alert('Scanning from browser not supported');
        var contact = self.contacts.at(0);
        this.scanSuccess({text: contact.id});
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
      alert("scanning failed: " + error)
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
      name:           {
                        title: 'Name',
                        validators: ['required'],
                        fieldClass: 'event-name',
                        editorAttrs: {
                          placeholder: 'e.g. Volunteer Club'
                        },
                        editorClass: 'span12'
                      },
      dtStart:        {
                        title: 'Start Date &amp; Time',
                        dataType: 'datetime',
                        validators: ['required'],
                        fieldClass: 'event-startdatetime',
                        editorClass: 'span12'
                      },
      dtEnd:          {
                        title: 'End Date &amp; Time',
                        dataType: 'datetime',
                        validators: ['required'],
                        fieldClass: 'event-enddatetime',
                        editorClass: 'span12'
                      },
      location:       {
                        title: 'Location',
                        fieldClass: 'event-location',
                        editorAttrs: {
                          placeholder: 'e.g. Chicago Ave.'
                        },
                        help: '(optional)',
                        editorClass: 'span12'
                      },
      facilitator:    {
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
        class: this.options.idPrefix + 'modal modal'
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
      if (self.os=='ios') {
        this.form = new Backbone.Form({
          model: new self.EventSchema({
            _id: this.model.id,
            accountId: self.account.id,
            name: this.model.get('name'),
            dtStart: self.helpers.datePickerFormats[self.os].datetime(this.model.get('dtStart')),
            dtEnd: self.helpers.datePickerFormats[self.os].datetime(this.model.get('dtEnd')),
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
        model: (self.os=='ios') ? new self.EventSchema() : new self.EventSchemaDetail(),
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
        , attendee = (attendees.length>0)
          ? attendees[0]
          : new self.Attendee({
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
        if (!(action.get('eventId')==this.event.id && action.get('contactId')==this.model.id))
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
      return this.model.get('status')=='in' ? 'label-success' : 'label-important';
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
    initialize: function() {
      _.bindAll(this, 'renderContact');
      self.contacts.on('reset', this.renderContacts, this);
    },
    render: function() {
      this.list = this.$el.find('.contact-list').empty();
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
      var view = new self.ContactLiView({model: contact});
      this.list.append(view.render().el);
    },
    showDeleteAlert: function() {
      this.$el.find('.delete-alert').removeClass('hide');
      _.delay(_.bind(function() {
        this.$el.find('.delete-alert').addClass('hide');
      }, this), 3000);
    }
  });

  self.ContactLiView = Backbone.View.extend({
    tagName: 'li',
    template: _.template($('#contact-li-view-template').html()),
    render: function() {
      this.$el.html(this.template(_.extend(this.model.toJSON(), self.helpers)));
      return this;
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
      first:          {
                        title: 'First name',
                        validators: ['required'],
                        fieldClass: 'contact-first',
                        editorAttrs: {
                          placeholder: 'e.g. Jane'
                        },
                        editorClass: 'span12'
                      },
      last:           {
                        title: 'Last name',
                        validators: ['required'],
                        fieldClass: 'contact-last',
                        editorAttrs: {
                          placeholder: 'e.g. Smith'
                        },
                        editorClass: 'span12'
                      },
      role:           {
                        title: 'Role',
                        type: 'Select',
                        options: ['participant', 'tutor', 'family', 'guest'],
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

  self.TransactionSchema = Backbone.Model.extend({
    schema: {
      type: {
        title: 'Transaction Type',
        type: 'Select',
        options: ['Subscription Refill', 'Yearly Fee', 'Adhoc Fee'],
        validators: ['required'],
        fieldClass: 'transaction-type',
        editorClass: 'span12'
      },
      amountCash: {
        title: 'Cash Amount',
        validators: ['required'],
        fieldClass: 'transaction-cash',
        editorClass: 'span3 currency',
        template: 'currency'
      },
      amountCheck:    {
        title: 'Check Amount',
        validators: ['required'],
        fieldClass: 'transaction-check',
        editorClass: 'span3 currency',
        template: 'currency'
      }
    }
  });

  self.TransactionCreateView = BaseFormView.extend({
    initialize: function() {
      _.bindAll(this, 'transactionCreateSuccess', 'transactionCreateError');
      this.model = new self.Transaction({contactId: this.options.contactId});
      this.form = new Backbone.Form({
        model: new self.TransactionSchema({
          amountCash: '5.00',
          amountCheck: '0.00'
        }),
        idPrefix: 'transaction-'
      });
    },
    commitForm: function(e) {
      e.preventDefault();
      var errors = this.form.commit();
      if (!errors) {
        self.transactions.create(
          _.extend(
            self.account.meta(),
            this.options,
            this.form.model.toJSON()
          ), {
          success: this.transactionCreateSuccess,
          error: this.transactionCreateError
        });
      }
    },
    transactionCreateSuccess: function(model) {
      // Reset model
      this.form.model.clear();
      // Go to new contact transactions list
      self.router.navigate('contacts/' + model.get('contactId') + '/transactions', {trigger: true});
      // Show alert
      self.router.renderedViews['ContactTransactionsView'][model.get('contactId')].showAddAlert();
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
        firstLast: _.bind(this.model.firstLast, this.model)
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
        amountTotal: _.bind(this.model.amountTotal, this.model)
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
        firstLast: _.bind(this.model.firstLast, this.model)
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
      return (this.status=='in') ? 'into' : 'out of';
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
//      } else if (sessionId) {
//        // Session cookie set, need to retrieve account then move along...
//        console.log('account cookie set. need to fetch');
//        self.account.setUrlRoot('session');
//        self.account.fetch({
//          data: {sessionId: sessionId},
//          success: function(model, resp) {
//            // Reset account url
//            self.account.setUrlRoot('account');
//            // Set session ID
//            self.account.set({sessionId: sessionId}, {silent: true});
//            console.log('account', self.account.toJSON());
//            // Load data
//            self.router.navigate('loading', {trigger: true});
//          },
//          error: function(model, resp) {
//            // Remove stale cookie
//            $.cookie(self.cookies.session, null);
//            console.error(resp.responseText);
//            // Reset account URL
//            self.account.setUrlRoot('account');
//            // Go to sign in page again
//            self.router.navigate('account/sign-in', {trigger: true});
//          }
//        });
      } else {
        // Make user sign in
        var id = 0;
        $('.page').addClass('hide');
        if (_.has(this.renderedViews.SignInView, id)) {
          this.renderedViews.SignInView[id].$el.removeClass('hide');
        } else {
          this.renderViews(id, ['SignInView']);
          this.renderedViews.SignInView[id].$el.removeClass('hide');
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
            this.renderedViews['EventsView'][0].showDeleteAlert();
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
            this.renderedViews['ContactsView'][0].showDeleteAlert();
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
  
};