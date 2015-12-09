/*
 * Stardog Sync
 * http://about.me/mattonfoot
 *
 * Copyright (c) 2015 Matt Smith, contributors
 * Licensed under the MIT license.
 */

(function( module ) {
'use strict';

var Stardog = require('stardog');
var RSVP = require('rsvp');
var Promise = RSVP.Promise;

function StardogConnection() {
  this.connection = new Stardog.Connection();
  this.queue = [];
  this.processing = false;
}
StardogConnection.prototype.setEndpoint = function( x ) {
  this.connection.setEndpoint( x );
};
StardogConnection.prototype.setCredentials = function( u, p ) {
  this.connection.setCredentials( u, p );
};
StardogConnection.prototype.setReasoning = function( x ) {
  this.connection.setReasoning( x );
};
StardogConnection.prototype.queryGraph = function( opts, onComplete ) {
  this.queue.push({
    type: 'queryGraph',
    opts: opts,
    onComplete: onComplete
  });

  if (!this.processing) this.processNext();
};
StardogConnection.prototype.query = function( opts, onComplete ) {
  this.queue.push({
    type: 'query',
    opts: opts,
    onComplete: onComplete
  });

  if (!this.processing) this.processNext();
};
var i = 0;
StardogConnection.prototype.processNext = function() {
  this.processing = true;
  var query = this.queue.shift();
  if ( !query ) {
    this.processing = false;
    return;
  }

  var sc = this;
  this.connection[ query.type ]( query.opts, function( d ) {
    sc.processNext();

    query.onComplete.apply( null, arguments );
  });
};

module.exports = {
  Connection: StardogConnection
};

})( module );
