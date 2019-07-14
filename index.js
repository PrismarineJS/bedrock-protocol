'use strict';

const path = require('path');
const register = require('@babel/register').default;
register({
    extends: path.resolve(__dirname, '.babelrc'),
    ignore: [/node_modules/],
    extensions: [
        ".js",
        ".ts"
    ]
});

module.exports = require('./src/index.js');
