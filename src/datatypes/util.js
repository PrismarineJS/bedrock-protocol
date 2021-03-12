const fs = require('fs');

function getFiles(dir) {
  var results = [];
  var list = fs.readdirSync(dir);
  list.forEach(function (file) {
    file = dir + '/' + file;
    var stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      /* Recurse into a subdirectory */
      results = results.concat(getFiles(file));
    } else {
      /* Is a file */
      results.push(file);
    }
  });
  return results;
}

module.exports = {
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms))
  },

  waitFor(cb, withTimeout) {
    return Promise.race([
      new Promise((res, rej) => cb(res)),
      sleep(withTimeout)
    ])
  },

  serialize(obj = {}, fmt) {
    return JSON.stringify(obj, (k, v) => typeof v == 'bigint' ? v.toString() : v, fmt)
  },

  getFiles
}