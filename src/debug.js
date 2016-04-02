var util = require('util')

var debug;
if(process.env.NODE_DEBUG) {
  var pid = process.pid;
  debug = function(x) {
    if(!console.error)
      return;
    console.error('MCPE-PROTO: %d', pid,
      util.format.apply(util, arguments));
  };
} else {
  debug = function() {}
}

module.exports = debug;
