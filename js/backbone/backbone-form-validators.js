
/*
 * Use with backbone-forms.js for validating form fields
 */

var gte6 = function(value, formValues) {
  if (value.length < 6) 
    return {
      type: 'password',
      message: 'Password must be at least 6 characters long'
    };
};