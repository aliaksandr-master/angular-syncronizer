/*eslint-disable prefer-template*/
'use strict';

const webpack = require('webpack');
const config = {};

config.entry = {
  'angular-syncronizer': [
    __dirname + '/src/angular-syncronizer'
  ]
};

config.output = {
  path: __dirname + '/dist',
  filename: '[name].js'
};

config.module = {
  noParse: [
  ],
  preLoaders: [
    {
      test: /\.js$/,
      loader: 'eslint',
      exclude: [ /\/node_modules\// ]
    }
  ],
  loaders: [
    {
      test: /\.(?:js)(?:\?.*)?$/i,
      exclude: [ /\/node_modules\// ],
      loaders: [
        'ng-annotate',
        'babel?' +
          [
            'presets[]=es2015',
            'plugins[]=transform-runtime'
          ].join('&')
      ]
    }
  ]
};

config.watch = false;

config.plugins = [
  new webpack.NoErrorsPlugin(),

  new webpack.optimize.DedupePlugin(),

  new webpack.optimize.OccurenceOrderPlugin(true),

  new webpack.optimize.UglifyJsPlugin({

  }),

  new webpack.ProgressPlugin((percentage, msg) => {
    console.log('[webpack compiling] ' + (percentage * 100).toFixed(0) + '% ' + msg);
    if (percentage === 1) {
      console.log('-----------------------');
    }
  })
];

config.bail = true;

config.resolve = {
  root: __dirname,
  moduleDirectories: [ 'node_modules' ],
  extensions: [ '', '.js' ],
  alias: {}
};

config.cache = true;
config.watch = true;

module.exports = config;
