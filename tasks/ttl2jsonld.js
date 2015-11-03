/*
 * TTL 2 JSON-LD
 * http://about.me/mattonfoot
 *
 * Copyright (c) 2015 Matt Smith, contributors
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function( grunt ) {
  var ttl2jsonld = require( './lib/ttl2jsonld' )( grunt );

  grunt.registerMultiTask('ttl2jsonld', 'Store JSON-LD framed graph output from SPARQL queries.', function() {
    ttl2jsonld.options = this.options({});

    // check options to ensure they are suitable
/*
    if (grunt.util._.include(['zip', 'tar', 'tgz', 'gzip', 'deflate', 'deflateRaw'], compress.options.mode) === false) {
      grunt.fail.warn('Mode ' + String(compress.options.mode).cyan + ' not supported.');
    }
*/

    ttl2jsonld.query( this.async() );
  });
};
