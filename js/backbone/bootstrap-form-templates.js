;(function() {
  var templates = {
    form: '\
      <form>{{fieldsets}}</form>\
    ',
    
    formStacked: '\
      <form>{{fieldsets}}</form>\
    ',

    fieldset: '\
      <fieldset>\
        {{legend}}\
        {{fields}}\
      </fieldset>\
    ',

    // field: '\
      // <div class="control-group">\
        // <label class="control-label" for="{{id}}">{{title}}</label>\
        // <div class="controls">\
          // <div class="input-xlarge">{{editor}}</div>\
          // <div class="help-block">{{help}}</div>\
        // </div>\
      // </div>\
    // ',
    
    field: '\
      <div class="control-group">\
        <label class="control-label" for="{{id}}">\
          {{title}}\
          <div class="help-inline help">{{help}}</div>\
        </label>\
        <div class="controls">\
          <div class="input">{{editor}}</div>\
        </div>\
      </div>\
    '
  };
  
  var classNames = {
    error: 'error'
  };

  Backbone.Form.helpers.setTemplates(templates, classNames);
})();
